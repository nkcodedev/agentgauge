import { describe, expect, it, vi } from "vitest";
import { AgentGauge, type TraceEvent } from "@agentgauge/node";
import { observeAnthropic } from "./observe-anthropic.js";
import { OPERATION_MESSAGES_CREATE } from "./types.js";
import {
  extractMessagesUsage,
  extractModel,
  extractUsageDetails,
  isStreamingRequest,
} from "./usage.js";

function collectGauge() {
  const events: TraceEvent[] = [];
  const gauge = new AgentGauge({
    project: "from-gauge",
    environment: "test",
    transport: {
      async send(event) {
        events.push(event);
      },
    },
  });
  return { gauge, events };
}

function createMockAnthropic(handlers: {
  messagesCreate?: (body: unknown) => Promise<unknown>;
  stream?: (body: unknown) => Promise<unknown>;
  modelsList?: () => Promise<unknown>;
}) {
  return {
    messages: {
      create: vi.fn(handlers.messagesCreate ?? (async () => ({}))),
      ...(handlers.stream
        ? { stream: vi.fn(handlers.stream) }
        : { stream: vi.fn(async () => ({ stream: true })) }),
    },
    models: {
      list: vi.fn(handlers.modelsList ?? (async () => ({ data: [] }))),
    },
  };
}

describe("usage extraction", () => {
  it("normalizes Messages usage", () => {
    expect(
      extractMessagesUsage({
        input_tokens: 25,
        output_tokens: 13,
      }),
    ).toEqual({ inputTokens: 25, outputTokens: 13 });
  });

  it("maps cache fields into usageDetails", () => {
    expect(
      extractUsageDetails({
        input_tokens: 25,
        output_tokens: 13,
        cache_read_input_tokens: 10,
        cache_creation_input_tokens: 4,
      }),
    ).toEqual({ cachedInputTokens: 10, cacheWriteTokens: 4 });
  });

  it("handles absent usage", () => {
    expect(extractMessagesUsage(undefined)).toEqual({});
    expect(extractUsageDetails(null)).toBeUndefined();
  });

  it("prefers response model over request model", () => {
    expect(extractModel({ model: "claude-from-response" }, { model: "claude-from-request" })).toBe(
      "claude-from-response",
    );
    expect(extractModel({}, { model: "claude-from-request" })).toBe("claude-from-request");
  });

  it("detects streaming requests", () => {
    expect(isStreamingRequest({ stream: true })).toBe(true);
    expect(isStreamingRequest({ stream: false })).toBe(false);
  });
});

describe("observeAnthropic messages.create", () => {
  it("captures success telemetry and returns original response", async () => {
    const { gauge, events } = collectGauge();
    const response = {
      id: "msg_1",
      model: "claude-sonnet-4-5",
      content: [{ type: "text", text: "secret completion text" }],
      usage: {
        input_tokens: 100,
        output_tokens: 25,
        cache_read_input_tokens: 12,
        cache_creation_input_tokens: 3,
      },
    };
    const client = createMockAnthropic({
      messagesCreate: async () => response,
    });
    const anthropic = observeAnthropic(client, {
      gauge,
      agentId: "support-agent",
    });

    const result = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result).toBe(response);
    expect(events).toHaveLength(1);
    const event = events[0]!;
    expect(event.provider).toBe("anthropic");
    expect(event.operationName).toBe(OPERATION_MESSAGES_CREATE);
    expect(event.agentId).toBe("support-agent");
    expect(event.model).toBe("claude-sonnet-4-5");
    expect(event.status).toBe("success");
    expect(event.usage).toEqual({
      inputTokens: 100,
      outputTokens: 25,
      totalTokens: 125,
    });
    expect(event.metadata?.usageDetails).toEqual({
      cachedInputTokens: 12,
      cacheWriteTokens: 3,
    });
    expect(event.latencyMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(event)).not.toContain("secret completion text");
    expect(JSON.stringify(event)).not.toContain("Hello");
  });

  it("derives totalTokens when Anthropic omits total", async () => {
    const { gauge, events } = collectGauge();
    const client = createMockAnthropic({
      messagesCreate: async () => ({
        model: "claude-haiku",
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    });
    const anthropic = observeAnthropic(client, { gauge, agentId: "a" });
    await anthropic.messages.create({
      model: "claude-haiku",
      max_tokens: 16,
      messages: [{ role: "user", content: "hi" }],
    });
    expect(events[0]!.usage).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    });
  });

  it("allows missing usage without fabricating zeros", async () => {
    const { gauge, events } = collectGauge();
    const client = createMockAnthropic({
      messagesCreate: async () => ({ model: "claude-haiku" }),
    });
    const anthropic = observeAnthropic(client, { gauge, agentId: "a" });
    await anthropic.messages.create({
      model: "claude-haiku",
      max_tokens: 16,
      messages: [{ role: "user", content: "hi" }],
    });
    expect(events[0]!.usage).toBeUndefined();
  });

  it("rethrows original Anthropic errors and records failure", async () => {
    const { gauge, events } = collectGauge();
    const anthropicError = Object.assign(new Error("rate limited"), {
      name: "APIError",
      code: "rate_limit_error",
      status: 429,
      request: { messages: [{ role: "user", content: "secret" }] },
      response: { body: "secret body" },
    });
    const client = createMockAnthropic({
      messagesCreate: async () => {
        throw anthropicError;
      },
    });
    const anthropic = observeAnthropic(client, { gauge, agentId: "a" });

    await expect(
      anthropic.messages.create({
        model: "claude-haiku",
        max_tokens: 16,
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toBe(anthropicError);

    expect(events).toHaveLength(1);
    expect(events[0]!.status).toBe("error");
    expect(events[0]!.error?.name).toBe("APIError");
    expect(events[0]!.error?.message).toBe("rate limited");
    expect(events[0]!.error?.code).toBe("rate_limit_error");
    expect(JSON.stringify(events[0]!)).not.toContain("secret");
  });

  it("returns Anthropic response when telemetry send fails", async () => {
    const response = { model: "claude-haiku", usage: { input_tokens: 1, output_tokens: 1 } };
    const gauge = new AgentGauge({
      transport: {
        async send() {
          throw new Error("transport down");
        },
      },
    });
    const client = createMockAnthropic({
      messagesCreate: async () => response,
    });
    const anthropic = observeAnthropic(client, { gauge, agentId: "a" });
    await expect(
      anthropic.messages.create({
        model: "claude-haiku",
        max_tokens: 16,
        messages: [{ role: "user", content: "hi" }],
      }),
    ).resolves.toBe(response);
  });

  it("rethrows Anthropic error when transport also fails", async () => {
    const anthropicError = new Error("provider boom");
    const gauge = new AgentGauge({
      transport: {
        async send() {
          throw new Error("transport down");
        },
      },
    });
    const client = createMockAnthropic({
      messagesCreate: async () => {
        throw anthropicError;
      },
    });
    const anthropic = observeAnthropic(client, { gauge, agentId: "a" });
    await expect(
      anthropic.messages.create({
        model: "claude-haiku",
        max_tokens: 16,
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toBe(anthropicError);
  });

  it("passes through streaming requests without telemetry", async () => {
    const { gauge, events } = collectGauge();
    const streamResult = { stream: true, tee: () => undefined };
    const client = createMockAnthropic({
      messagesCreate: async () => streamResult,
    });
    const anthropic = observeAnthropic(client, { gauge, agentId: "a" });
    const result = await anthropic.messages.create({
      model: "claude-haiku",
      max_tokens: 16,
      stream: true,
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result).toBe(streamResult);
    expect(events).toHaveLength(0);
  });

  it("passes through non-intercepted methods/properties", async () => {
    const { gauge } = collectGauge();
    const client = createMockAnthropic({
      modelsList: async () => ({ data: ["ok"] }),
    });
    const anthropic = observeAnthropic(client, { gauge, agentId: "a" });
    await expect(anthropic.models.list()).resolves.toEqual({ data: ["ok"] });
    await expect(anthropic.messages.stream({ model: "x" })).resolves.toEqual({ stream: true });
  });

  it("does not mutate the original client", async () => {
    const { gauge, events } = collectGauge();
    const client = createMockAnthropic({
      messagesCreate: async () => ({ model: "claude-haiku", usage: { input_tokens: 1 } }),
    });
    const wrapped = observeAnthropic(client, { gauge, agentId: "a" });
    await wrapped.messages.create({
      model: "claude-haiku",
      max_tokens: 16,
      messages: [{ role: "user", content: "hi" }],
    });
    await client.messages.create({
      model: "claude-haiku",
      max_tokens: 16,
      messages: [{ role: "user", content: "hi" }],
    });
    // Only the wrapped client emits telemetry
    expect(events).toHaveLength(1);
  });

  it("applies observe options for project/environment/tags", async () => {
    const { gauge, events } = collectGauge();
    const client = createMockAnthropic({
      messagesCreate: async () => ({ model: "claude-haiku", usage: { input_tokens: 1 } }),
    });
    const anthropic = observeAnthropic(client, {
      gauge,
      agentId: "a",
      project: "from-options",
      environment: "staging",
      tags: ["tier:pro"],
    });
    await anthropic.messages.create({
      model: "claude-haiku",
      max_tokens: 16,
      messages: [{ role: "user", content: "hi" }],
    });
    expect(events[0]!.project).toBe("from-options");
    expect(events[0]!.environment).toBe("staging");
    expect(events[0]!.tags).toEqual(["tier:pro"]);
  });

  it("rejects invalid options", () => {
    const { gauge } = collectGauge();
    const client = createMockAnthropic({});
    expect(() => observeAnthropic(client, null as never)).toThrow(/options/);
    expect(() => observeAnthropic(client, { gauge, agentId: "  " })).toThrow(/agentId/);
  });
});

describe("privacy", () => {
  it("never records content-bearing metadata keys from responses", async () => {
    const { gauge, events } = collectGauge();
    const client = createMockAnthropic({
      messagesCreate: async () => ({
        model: "claude-haiku",
        content: [{ type: "text", text: "leak" }],
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    });
    const anthropic = observeAnthropic(client, { gauge, agentId: "a" });
    await anthropic.messages.create({
      model: "claude-haiku",
      max_tokens: 16,
      system: "secret system",
      messages: [{ role: "user", content: "secret user" }],
    });
    const serialized = JSON.stringify(events[0]);
    for (const needle of [
      "secret system",
      "secret user",
      "leak",
      '"messages"',
      '"content"',
      '"system"',
      "apiKey",
      "authorization",
    ]) {
      expect(serialized).not.toContain(needle);
    }
  });
});
