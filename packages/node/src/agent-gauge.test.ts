import { afterEach, describe, expect, it, vi } from "vitest";
import type { TraceEvent } from "@agentgauge/core";
import { ConfigurationError, ValidationError } from "@agentgauge/core";
import { AgentGauge } from "./agent-gauge.js";
import { ConsoleTransport } from "./console-transport.js";
import { HttpTransport } from "./http-transport.js";
import { SDK_NAME, SDK_VERSION } from "./version.js";

function collectTransport() {
  const events: TraceEvent[] = [];
  return {
    events,
    transport: {
      async send(event: TraceEvent) {
        events.push(event);
      },
    },
  };
}

describe("AgentGauge manual tracing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("starts and successfully completes a trace", async () => {
    const { events, transport } = collectTransport();
    const gauge = new AgentGauge({
      project: "demo",
      environment: "test",
      transport,
    });

    const trace = gauge.startTrace({
      agentId: "support-agent",
      provider: "openai",
      model: "gpt-5",
      operationName: "answer-customer",
      tags: ["tier:pro"],
      metadata: { region: "us-east-1" },
    });

    expect(trace.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(trace.traceId).toBe(trace.eventId);

    trace.end({ inputTokens: 1200, outputTokens: 320 });
    await gauge.flush();

    expect(events).toHaveLength(1);
    const event = events[0]!;
    expect(event.agentId).toBe("support-agent");
    expect(event.project).toBe("demo");
    expect(event.environment).toBe("test");
    expect(event.provider).toBe("openai");
    expect(event.model).toBe("gpt-5");
    expect(event.operationName).toBe("answer-customer");
    expect(event.status).toBe("success");
    expect(event.usage).toEqual({
      inputTokens: 1200,
      outputTokens: 320,
      totalTokens: 1520,
    });
    expect(event.startedAt).toMatch(/Z$/);
    expect(event.endedAt).toMatch(/Z$/);
    expect(event.latencyMs).toBeGreaterThanOrEqual(0);
    expect(event.sdk).toEqual({ name: SDK_NAME, version: SDK_VERSION });
    expect(event.tags).toEqual(["tier:pro"]);
    expect(event.metadata).toEqual({ region: "us-east-1" });
  });

  it("records failed traces", async () => {
    const { events, transport } = collectTransport();
    const gauge = new AgentGauge({ transport });

    const trace = gauge.startTrace({ agentId: "agent" });
    trace.fail(new Error("upstream failed"));
    await gauge.flush();

    expect(events[0]!.status).toBe("error");
    expect(events[0]!.error).toEqual({
      name: "Error",
      message: "upstream failed",
    });
  });

  it("generates unique IDs", async () => {
    const { events, transport } = collectTransport();
    const gauge = new AgentGauge({ transport });
    const a = gauge.startTrace({ agentId: "a" });
    const b = gauge.startTrace({ agentId: "b" });
    a.end();
    b.end();
    await gauge.flush();
    expect(events[0]!.eventId).not.toBe(events[1]!.eventId);
  });

  it("applies config defaults and allows trace overrides", async () => {
    const { events, transport } = collectTransport();
    const gauge = new AgentGauge({
      project: "from-config",
      environment: "prod",
      transport,
    });
    gauge.startTrace({ agentId: "a", project: "from-trace" }).end();
    await gauge.flush();
    expect(events[0]!.project).toBe("from-trace");
    expect(events[0]!.environment).toBe("prod");
  });

  it("rejects empty agentId", () => {
    const gauge = new AgentGauge({ transport: collectTransport().transport });
    expect(() => gauge.startTrace({ agentId: "" })).toThrow(ValidationError);
  });

  it("throws on duplicate end()", async () => {
    const gauge = new AgentGauge({ transport: collectTransport().transport });
    const trace = gauge.startTrace({ agentId: "a" });
    trace.end();
    expect(() => trace.end()).toThrow(ConfigurationError);
  });

  it("throws when fail() follows end()", () => {
    const gauge = new AgentGauge({ transport: collectTransport().transport });
    const trace = gauge.startTrace({ agentId: "a" });
    trace.end();
    expect(() => trace.fail(new Error("x"))).toThrow(ConfigurationError);
  });

  it("throws when end() follows fail()", () => {
    const gauge = new AgentGauge({ transport: collectTransport().transport });
    const trace = gauge.startTrace({ agentId: "a" });
    trace.fail(new Error("x"));
    expect(() => trace.end()).toThrow(ConfigurationError);
  });

  it("does not throw into customer path when transport fails", async () => {
    const errors: unknown[] = [];
    const gauge = new AgentGauge({
      transport: {
        async send() {
          throw new Error("API unavailable");
        },
      },
      onTransportError: (error) => {
        errors.push(error);
      },
    });

    const trace = gauge.startTrace({ agentId: "a" });
    expect(() => trace.end({ inputTokens: 1, outputTokens: 1 })).not.toThrow();
    await gauge.flush();
    expect(errors).toHaveLength(1);
  });

  it("never includes apiKey in event payload", async () => {
    const { events, transport } = collectTransport();
    const gauge = new AgentGauge({
      apiKey: "ag_test_secret_key",
      transport,
    });
    gauge.startTrace({ agentId: "a" }).end();
    await gauge.flush();
    const serialized = JSON.stringify(events[0]);
    expect(serialized).not.toContain("ag_test_secret_key");
    expect(serialized).not.toContain("apiKey");
  });

  it("rejects startTrace after shutdown", async () => {
    const gauge = new AgentGauge({ transport: collectTransport().transport });
    await gauge.shutdown();
    expect(() => gauge.startTrace({ agentId: "a" })).toThrow(ConfigurationError);
  });

  it("rejects end after shutdown even if started before", async () => {
    const gauge = new AgentGauge({ transport: collectTransport().transport });
    const trace = gauge.startTrace({ agentId: "a" });
    await gauge.shutdown();
    expect(() => trace.end()).toThrow(ConfigurationError);
  });
});

describe("ConsoleTransport", () => {
  it("prints normalized telemetry without api keys", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const transport = new ConsoleTransport();
    const event: TraceEvent = {
      eventId: "e",
      traceId: "t",
      agentId: "a",
      startedAt: "2026-10-01T10:30:45.123Z",
      endedAt: "2026-10-01T10:30:46.123Z",
      latencyMs: 1000,
      status: "success",
      sdk: { name: SDK_NAME, version: SDK_VERSION },
    };
    await transport.send(event);
    expect(log).toHaveBeenCalledOnce();
    const printed = String(log.mock.calls[0]?.[1]);
    expect(printed).toContain('"agentId":"a"');
    expect(printed).not.toContain("apiKey");
  });
});

describe("HttpTransport", () => {
  it("serializes batch envelope and sets Authorization header", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const transport = new HttpTransport({
      endpoint: "https://example.test/v1/traces",
      apiKey: "ag_test_example",
      fetchImpl,
    });

    const event: TraceEvent = {
      eventId: "e",
      traceId: "t",
      agentId: "a",
      startedAt: "2026-10-01T10:30:45.123Z",
      endedAt: "2026-10-01T10:30:46.123Z",
      latencyMs: 10,
      status: "success",
      sdk: { name: SDK_NAME, version: SDK_VERSION },
    };

    await transport.send(event);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://example.test/v1/traces");
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer ag_test_example");
    expect(headers["content-type"]).toBe("application/json");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ events: [event] });
    expect(String(calls[0]!.init.body)).not.toContain("ag_test_example");
  });

  it("requires endpoint", () => {
    expect(() => new HttpTransport({ endpoint: " " })).toThrow(ConfigurationError);
  });

  it("requires apiKey for http shorthand config", () => {
    expect(
      () =>
        new AgentGauge({
          transport: { type: "http", endpoint: "https://example.test/v1/traces" },
        }),
    ).toThrow(/apiKey/);
  });

  it("supports http shorthand with apiKey from config", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const gauge = new AgentGauge({
      apiKey: "ag_test_example",
      transport: new HttpTransport({
        endpoint: "https://example.test/v1/traces",
        apiKey: "ag_test_example",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    });
    gauge.startTrace({ agentId: "a" }).end();
    await gauge.flush();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

describe("shorthand console transport", () => {
  it("accepts transport: { type: 'console' }", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const gauge = new AgentGauge({ transport: { type: "console" } });
    gauge.startTrace({ agentId: "a" }).end();
    await gauge.flush();
    expect(log).toHaveBeenCalled();
  });
});
