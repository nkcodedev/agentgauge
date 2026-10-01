import { describe, expect, it, vi } from "vitest";
import { AgentGauge, type TraceEvent } from "@agentgauge/node";
import { observeOpenAI } from "./observe-openai.js";
import { OPERATION_CHAT_COMPLETIONS_CREATE, OPERATION_RESPONSES_CREATE } from "./types.js";
import { extractChatCompletionsUsage, extractResponsesUsage, isStreamingRequest } from "./usage.js";

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

function createMockOpenAI(handlers: {
  responsesCreate?: (body: unknown) => Promise<unknown>;
  chatCreate?: (body: unknown) => Promise<unknown>;
}) {
  return {
    responses: {
      create: vi.fn(handlers.responsesCreate ?? (async () => ({}))),
    },
    chat: {
      completions: {
        create: vi.fn(handlers.chatCreate ?? (async () => ({}))),
      },
    },
    unrelated: {
      ping: vi.fn(async () => "pong"),
    },
  };
}

describe("usage extraction", () => {
  it("normalizes Responses usage", () => {
    expect(
      extractResponsesUsage({
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
      }),
    ).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
  });

  it("normalizes Chat Completions usage", () => {
    expect(
      extractChatCompletionsUsage({
        prompt_tokens: 3,
        completion_tokens: 4,
        total_tokens: 7,
      }),
    ).toEqual({ inputTokens: 3, outputTokens: 4, totalTokens: 7 });
  });

  it("handles absent usage", () => {
    expect(extractResponsesUsage(undefined)).toEqual({});
    expect(extractChatCompletionsUsage(null)).toEqual({});
  });

  it("detects streaming requests", () => {
    expect(isStreamingRequest({ stream: true })).toBe(true);
    expect(isStreamingRequest({ stream: false })).toBe(false);
  });
});

describe("observeOpenAI responses.create", () => {
  it("captures success telemetry and returns original response", async () => {
    const { gauge, events } = collectGauge();
    const response = {
      id: "resp_1",
      model: "gpt-5",
      usage: { input_tokens: 100, output_tokens: 25, total_tokens: 125 },
      output_text: "secret completion text",
    };
    const client = createMockOpenAI({
      responsesCreate: async () => response,
    });

    const openai = observeOpenAI(client, {
      gauge,
      agentId: "support-agent",
      tags: ["support"],
      metadata: { feature: "reply-generation" },
    });

    const result = await openai.responses.create({
      model: "gpt-5",
      input: "Explain circuit breakers simply.",
    });

    expect(result).toBe(response);
    expect(client.responses.create).toHaveBeenCalledOnce();
    await gauge.flush();

    expect(events).toHaveLength(1);
    const event = events[0]!;
    expect(event.provider).toBe("openai");
    expect(event.model).toBe("gpt-5");
    expect(event.agentId).toBe("support-agent");
    expect(event.operationName).toBe(OPERATION_RESPONSES_CREATE);
    expect(event.status).toBe("success");
    expect(event.usage).toEqual({
      inputTokens: 100,
      outputTokens: 25,
      totalTokens: 125,
    });
    expect(event.latencyMs).toBeGreaterThanOrEqual(0);
    expect(event.project).toBe("from-gauge");
    expect(event.tags).toEqual(["support"]);
    expect(event.metadata).toEqual({ feature: "reply-generation" });

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("Explain circuit breakers");
    expect(serialized).not.toContain("secret completion");
    expect(serialized).not.toContain("output_text");
    expect(serialized).not.toContain("OPENAI_API_KEY");
    expect(serialized).not.toContain("authorization");
    expect(event).not.toHaveProperty("input");
    expect(event).not.toHaveProperty("messages");
    expect(event).not.toHaveProperty("prompt");
  });

  it("derives total tokens when OpenAI omits total", async () => {
    const { gauge, events } = collectGauge();
    const client = createMockOpenAI({
      responsesCreate: async () => ({
        model: "gpt-5",
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    });
    const openai = observeOpenAI(client, { gauge, agentId: "a" });
    await openai.responses.create({ model: "gpt-5", input: "hi" });
    await gauge.flush();
    expect(events[0]!.usage).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    });
  });

  it("allows missing usage", async () => {
    const { gauge, events } = collectGauge();
    const client = createMockOpenAI({
      responsesCreate: async () => ({ model: "gpt-5" }),
    });
    const openai = observeOpenAI(client, { gauge, agentId: "a" });
    await openai.responses.create({ model: "gpt-5", input: "hi" });
    await gauge.flush();
    expect(events[0]!.usage).toBeUndefined();
    expect(events[0]!.status).toBe("success");
  });

  it("captures zero token values", async () => {
    const { gauge, events } = collectGauge();
    const client = createMockOpenAI({
      responsesCreate: async () => ({
        model: "gpt-5",
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      }),
    });
    const openai = observeOpenAI(client, { gauge, agentId: "a" });
    await openai.responses.create({ model: "gpt-5", input: "hi" });
    await gauge.flush();
    expect(events[0]!.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });
  });

  it("rethrows original OpenAI errors and records failure", async () => {
    const { gauge, events } = collectGauge();
    const openaiError = Object.assign(new Error("rate limited"), {
      name: "APIError",
      status: 429,
      code: "rate_limit_exceeded",
    });
    const client = createMockOpenAI({
      responsesCreate: async () => {
        throw openaiError;
      },
    });
    const openai = observeOpenAI(client, { gauge, agentId: "a" });

    await expect(openai.responses.create({ model: "gpt-5", input: "hi" })).rejects.toBe(
      openaiError,
    );

    await gauge.flush();
    expect(events[0]!.status).toBe("error");
    expect(events[0]!.error?.name).toBe("APIError");
    expect(events[0]!.error?.message).toBe("rate limited");
    expect(events[0]!.error?.code).toBe("rate_limit_exceeded");
  });

  it("returns OpenAI response when transport fails", async () => {
    const gauge = new AgentGauge({
      transport: {
        async send() {
          throw new Error("ingest down");
        },
      },
    });
    const response = { model: "gpt-5", usage: { input_tokens: 1, output_tokens: 1 } };
    const client = createMockOpenAI({
      responsesCreate: async () => response,
    });
    const openai = observeOpenAI(client, { gauge, agentId: "a" });
    await expect(openai.responses.create({ model: "gpt-5", input: "hi" })).resolves.toBe(response);
  });

  it("rethrows OpenAI error when transport also fails", async () => {
    const gauge = new AgentGauge({
      transport: {
        async send() {
          throw new Error("ingest down");
        },
      },
    });
    const openaiError = new Error("provider boom");
    const client = createMockOpenAI({
      responsesCreate: async () => {
        throw openaiError;
      },
    });
    const openai = observeOpenAI(client, { gauge, agentId: "a" });
    await expect(openai.responses.create({ model: "gpt-5", input: "hi" })).rejects.toBe(
      openaiError,
    );
  });

  it("passes through streaming requests without telemetry", async () => {
    const { gauge, events } = collectGauge();
    const streamResult = { stream: true };
    const client = createMockOpenAI({
      responsesCreate: async () => streamResult,
    });
    const openai = observeOpenAI(client, { gauge, agentId: "a" });
    const result = await openai.responses.create({
      model: "gpt-5",
      input: "hi",
      stream: true,
    });
    expect(result).toBe(streamResult);
    await gauge.flush();
    expect(events).toHaveLength(0);
  });

  it("does not instrument unrelated clients", async () => {
    const { gauge, events } = collectGauge();
    const instrumented = createMockOpenAI({
      responsesCreate: async () => ({ model: "gpt-5", usage: { input_tokens: 1 } }),
    });
    const plain = createMockOpenAI({
      responsesCreate: async () => ({ model: "gpt-5", usage: { input_tokens: 2 } }),
    });

    const wrapped = observeOpenAI(instrumented, { gauge, agentId: "a" });
    await wrapped.responses.create({ model: "gpt-5", input: "a" });
    await plain.responses.create({ model: "gpt-5", input: "b" });
    await gauge.flush();

    expect(events).toHaveLength(1);
    expect(events[0]!.usage?.inputTokens).toBe(1);
  });

  it("allows project override from observe options", async () => {
    const { gauge, events } = collectGauge();
    const client = createMockOpenAI({
      responsesCreate: async () => ({ model: "gpt-5" }),
    });
    const openai = observeOpenAI(client, {
      gauge,
      agentId: "a",
      project: "from-observe",
    });
    await openai.responses.create({ model: "gpt-5", input: "hi" });
    await gauge.flush();
    expect(events[0]!.project).toBe("from-observe");
  });
});

describe("observeOpenAI chat.completions.create", () => {
  it("captures chat completion telemetry", async () => {
    const { gauge, events } = collectGauge();
    const response = {
      model: "gpt-4.1-mini",
      usage: { prompt_tokens: 8, completion_tokens: 2, total_tokens: 10 },
      choices: [{ message: { content: "secret" } }],
    };
    const client = createMockOpenAI({
      chatCreate: async () => response,
    });
    const openai = observeOpenAI(client, { gauge, agentId: "chat-agent" });
    const result = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: "hello" }],
    });
    expect(result).toBe(response);
    await gauge.flush();
    expect(events[0]!.operationName).toBe(OPERATION_CHAT_COMPLETIONS_CREATE);
    expect(events[0]!.usage).toEqual({
      inputTokens: 8,
      outputTokens: 2,
      totalTokens: 10,
    });
    expect(JSON.stringify(events[0])).not.toContain("hello");
    expect(JSON.stringify(events[0])).not.toContain("secret");
  });
});
