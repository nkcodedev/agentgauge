import { describe, expect, it, vi } from "vitest";
import { AgentGauge, type TraceEvent } from "@agentgauge/node";
import { observeGemini } from "./observe-gemini.js";
import { OPERATION_GENERATE_CONTENT } from "./types.js";
import { extractGenerateContentUsage, extractModel, extractUsageDetails } from "./usage.js";

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

function createMockGoogleGenAI(handlers: {
  generateContent?: (body: unknown) => Promise<unknown>;
  generateContentStream?: (body: unknown) => Promise<unknown>;
  countTokens?: (body: unknown) => Promise<unknown>;
  filesList?: () => Promise<unknown>;
}) {
  return {
    models: {
      generateContent: vi.fn(handlers.generateContent ?? (async () => ({}))),
      generateContentStream: vi.fn(
        handlers.generateContentStream ?? (async () => ({ async *[Symbol.asyncIterator]() {} })),
      ),
      countTokens: vi.fn(handlers.countTokens ?? (async () => ({ totalTokens: 1 }))),
    },
    files: {
      list: vi.fn(handlers.filesList ?? (async () => ({ files: [] }))),
    },
  };
}

describe("usage extraction", () => {
  it("normalizes generateContent usageMetadata", () => {
    expect(
      extractGenerateContentUsage({
        promptTokenCount: 20,
        candidatesTokenCount: 8,
        totalTokenCount: 28,
      }),
    ).toEqual({ inputTokens: 20, outputTokens: 8, totalTokens: 28 });
  });

  it("accepts responseTokenCount as output alias", () => {
    expect(
      extractGenerateContentUsage({
        promptTokenCount: 5,
        responseTokenCount: 2,
      }),
    ).toEqual({ inputTokens: 5, outputTokens: 2 });
  });

  it("maps cache and thinking into usageDetails", () => {
    expect(
      extractUsageDetails({
        promptTokenCount: 20,
        cachedContentTokenCount: 7,
        thoughtsTokenCount: 3,
      }),
    ).toEqual({ cachedInputTokens: 7, reasoningTokens: 3 });
  });

  it("handles absent usage", () => {
    expect(extractGenerateContentUsage(undefined)).toEqual({});
    expect(extractUsageDetails(null)).toBeUndefined();
  });

  it("prefers response model over request model", () => {
    expect(extractModel({ model: "gemini-from-response" }, { model: "gemini-from-request" })).toBe(
      "gemini-from-response",
    );
    expect(extractModel({}, { model: "gemini-from-request" })).toBe("gemini-from-request");
  });
});

describe("observeGemini models.generateContent", () => {
  it("captures success telemetry and returns original response", async () => {
    const { gauge, events } = collectGauge();
    const response = {
      model: "gemini-2.5-flash",
      text: "secret generated text",
      candidates: [{ content: { parts: [{ text: "secret" }] } }],
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 25,
        totalTokenCount: 125,
        cachedContentTokenCount: 12,
        thoughtsTokenCount: 4,
      },
    };
    const client = createMockGoogleGenAI({
      generateContent: async () => response,
    });
    const ai = observeGemini(client, {
      gauge,
      agentId: "support-agent",
    });

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Hello",
    });

    expect(result).toBe(response);
    expect(events).toHaveLength(1);
    const event = events[0]!;
    expect(event.provider).toBe("google");
    expect(event.provider).not.toBe("gemini");
    expect(event.operationName).toBe(OPERATION_GENERATE_CONTENT);
    expect(event.agentId).toBe("support-agent");
    expect(event.model).toBe("gemini-2.5-flash");
    expect(event.status).toBe("success");
    expect(event.usage).toEqual({
      inputTokens: 100,
      outputTokens: 25,
      totalTokens: 125,
    });
    expect(event.metadata?.usageDetails).toEqual({
      cachedInputTokens: 12,
      reasoningTokens: 4,
    });
    expect(event.latencyMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(event)).not.toContain("secret");
    expect(JSON.stringify(event)).not.toContain("Hello");
  });

  it("derives totalTokens when Google omits totalTokenCount", async () => {
    const { gauge, events } = collectGauge();
    const client = createMockGoogleGenAI({
      generateContent: async () => ({
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
      }),
    });
    const ai = observeGemini(client, { gauge, agentId: "a" });
    await ai.models.generateContent({ model: "gemini-2.5-flash", contents: "hi" });
    expect(events[0]!.usage).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    });
  });

  it("prefers provider totalTokenCount over derived sum", async () => {
    const { gauge, events } = collectGauge();
    const client = createMockGoogleGenAI({
      generateContent: async () => ({
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 99,
        },
      }),
    });
    const ai = observeGemini(client, { gauge, agentId: "a" });
    await ai.models.generateContent({ model: "gemini-2.5-flash", contents: "hi" });
    expect(events[0]!.usage?.totalTokens).toBe(99);
  });

  it("allows missing usage without fabricating zeros", async () => {
    const { gauge, events } = collectGauge();
    const client = createMockGoogleGenAI({
      generateContent: async () => ({ model: "gemini-2.5-flash" }),
    });
    const ai = observeGemini(client, { gauge, agentId: "a" });
    await ai.models.generateContent({ model: "gemini-2.5-flash", contents: "hi" });
    expect(events[0]!.usage).toBeUndefined();
  });

  it("keeps partial usage fields as-is", async () => {
    const { gauge, events } = collectGauge();
    const client = createMockGoogleGenAI({
      generateContent: async () => ({
        usageMetadata: { promptTokenCount: 7 },
      }),
    });
    const ai = observeGemini(client, { gauge, agentId: "a" });
    await ai.models.generateContent({ model: "gemini-2.5-flash", contents: "hi" });
    expect(events[0]!.usage).toEqual({ inputTokens: 7 });
  });

  it("rethrows original Google errors and records failure", async () => {
    const { gauge, events } = collectGauge();
    const googleError = Object.assign(new Error("quota exceeded"), {
      name: "ApiError",
      code: 429,
      status: "RESOURCE_EXHAUSTED",
      request: { contents: "secret" },
      response: { candidates: [{ content: "secret" }] },
    });
    // normalizeTraceError only keeps string code — set string code for telemetry
    Object.assign(googleError, { code: "RESOURCE_EXHAUSTED" });

    const client = createMockGoogleGenAI({
      generateContent: async () => {
        throw googleError;
      },
    });
    const ai = observeGemini(client, { gauge, agentId: "a" });

    await expect(
      ai.models.generateContent({ model: "gemini-2.5-flash", contents: "hi" }),
    ).rejects.toBe(googleError);

    expect(events).toHaveLength(1);
    expect(events[0]!.status).toBe("error");
    expect(events[0]!.error?.name).toBe("ApiError");
    expect(events[0]!.error?.message).toBe("quota exceeded");
    expect(events[0]!.error?.code).toBe("RESOURCE_EXHAUSTED");
    expect(JSON.stringify(events[0]!)).not.toContain("secret");
  });

  it("returns Google response when telemetry send fails", async () => {
    const response = {
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
    };
    const gauge = new AgentGauge({
      transport: {
        async send() {
          throw new Error("transport down");
        },
      },
    });
    const client = createMockGoogleGenAI({
      generateContent: async () => response,
    });
    const ai = observeGemini(client, { gauge, agentId: "a" });
    await expect(
      ai.models.generateContent({ model: "gemini-2.5-flash", contents: "hi" }),
    ).resolves.toBe(response);
  });

  it("rethrows Google error when transport also fails", async () => {
    const googleError = new Error("provider boom");
    const gauge = new AgentGauge({
      transport: {
        async send() {
          throw new Error("transport down");
        },
      },
    });
    const client = createMockGoogleGenAI({
      generateContent: async () => {
        throw googleError;
      },
    });
    const ai = observeGemini(client, { gauge, agentId: "a" });
    await expect(
      ai.models.generateContent({ model: "gemini-2.5-flash", contents: "hi" }),
    ).rejects.toBe(googleError);
  });

  it("passes through generateContentStream without telemetry", async () => {
    const { gauge, events } = collectGauge();
    const streamResult = { async *[Symbol.asyncIterator]() {} };
    const client = createMockGoogleGenAI({
      generateContentStream: async () => streamResult,
    });
    const ai = observeGemini(client, { gauge, agentId: "a" });
    const result = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: "hi",
    });
    expect(result).toBe(streamResult);
    expect(events).toHaveLength(0);
  });

  it("passes through non-intercepted methods/properties", async () => {
    const { gauge } = collectGauge();
    const client = createMockGoogleGenAI({
      countTokens: async () => ({ totalTokens: 9 }),
      filesList: async () => ({ files: ["a"] }),
    });
    const ai = observeGemini(client, { gauge, agentId: "a" });
    await expect(
      ai.models.countTokens({ model: "gemini-2.5-flash", contents: "x" }),
    ).resolves.toEqual({
      totalTokens: 9,
    });
    await expect(ai.files.list()).resolves.toEqual({ files: ["a"] });
  });

  it("does not mutate the original client", async () => {
    const { gauge, events } = collectGauge();
    const client = createMockGoogleGenAI({
      generateContent: async () => ({
        usageMetadata: { promptTokenCount: 1 },
      }),
    });
    const wrapped = observeGemini(client, { gauge, agentId: "a" });
    await wrapped.models.generateContent({ model: "gemini-2.5-flash", contents: "hi" });
    await client.models.generateContent({ model: "gemini-2.5-flash", contents: "hi" });
    expect(events).toHaveLength(1);
  });

  it("applies observe options for project/environment/tags", async () => {
    const { gauge, events } = collectGauge();
    const client = createMockGoogleGenAI({
      generateContent: async () => ({
        usageMetadata: { promptTokenCount: 1 },
      }),
    });
    const ai = observeGemini(client, {
      gauge,
      agentId: "a",
      project: "from-options",
      environment: "staging",
      tags: ["tier:pro"],
    });
    await ai.models.generateContent({ model: "gemini-2.5-flash", contents: "hi" });
    expect(events[0]!.project).toBe("from-options");
    expect(events[0]!.environment).toBe("staging");
    expect(events[0]!.tags).toEqual(["tier:pro"]);
  });

  it("rejects invalid options", () => {
    const { gauge } = collectGauge();
    const client = createMockGoogleGenAI({});
    expect(() => observeGemini(client, null as never)).toThrow(/options/);
    expect(() => observeGemini(client, { gauge, agentId: "  " })).toThrow(/agentId/);
  });
});

describe("privacy", () => {
  it("never records content-bearing fields from requests/responses", async () => {
    const { gauge, events } = collectGauge();
    const client = createMockGoogleGenAI({
      generateContent: async () => ({
        text: "leak-text",
        candidates: [{ content: { parts: [{ text: "leak-candidate" }] } }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
      }),
    });
    const ai = observeGemini(client, { gauge, agentId: "a" });
    await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "secret contents",
      config: { systemInstruction: "secret system" },
    });
    const serialized = JSON.stringify(events[0]);
    for (const needle of [
      "secret contents",
      "secret system",
      "leak-text",
      "leak-candidate",
      '"contents"',
      '"candidates"',
      '"text"',
      "systemInstruction",
      "apiKey",
      "authorization",
    ]) {
      expect(serialized).not.toContain(needle);
    }
  });
});
