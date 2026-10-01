import { describe, expect, it } from "vitest";
import {
  AgentGaugeError,
  CANONICAL_PROVIDERS,
  ConfigurationError,
  ValidationError,
  buildTraceEvent,
  normalizeMetadata,
  normalizeTags,
  normalizeTokenUsage,
  normalizeTraceError,
  normalizeUsage,
  validateEndRunInput,
  validateEndTraceInput,
  validateFailTraceInput,
  validateStartRunInput,
  validateStartTraceInput,
} from "./index.js";

describe("errors", () => {
  it("exposes typed error codes", () => {
    expect(new ValidationError("bad").code).toBe("validation_error");
    expect(new ConfigurationError("cfg").code).toBe("configuration_error");
    expect(new AgentGaugeError("x").code).toBe("agentgauge_error");
  });
});

describe("canonical providers", () => {
  it("documents openai, anthropic, and google (not gemini)", () => {
    expect(CANONICAL_PROVIDERS.openai).toBe("openai");
    expect(CANONICAL_PROVIDERS.anthropic).toBe("anthropic");
    expect(CANONICAL_PROVIDERS.google).toBe("google");
    expect(Object.values(CANONICAL_PROVIDERS)).not.toContain("gemini");
  });
});

describe("validateStartTraceInput", () => {
  it("accepts valid telemetry start input", () => {
    const result = validateStartTraceInput({
      agentId: " support-agent ",
      provider: "openai",
      model: "gpt-5",
      operationName: "answer-customer",
      metadata: { region: "us-east-1" },
      tags: [" tier:pro "],
    });

    expect(result.agentId).toBe("support-agent");
    expect(result.provider).toBe("openai");
    expect(result.tags).toEqual(["tier:pro"]);
    expect(Object.isFrozen(result.metadata)).toBe(true);
  });

  it("accepts anthropic and google providers with canonical operation names", () => {
    expect(
      validateStartTraceInput({
        agentId: "a",
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        operationName: "anthropic.messages.create",
      }).provider,
    ).toBe("anthropic");

    expect(
      validateStartTraceInput({
        agentId: "a",
        provider: "google",
        model: "gemini-2.5-flash",
        operationName: "google.models.generateContent",
      }).provider,
    ).toBe("google");
  });

  it("rejects empty agentId", () => {
    expect(() => validateStartTraceInput({ agentId: "  " })).toThrow(ValidationError);
    expect(() => validateStartTraceInput({ agentId: "" })).toThrow(/agentId/);
  });

  it("rejects forbidden content metadata keys", () => {
    expect(() =>
      validateStartTraceInput({
        agentId: "a",
        metadata: { prompt: "secret" },
      }),
    ).toThrow(/prompt/);

    expect(() =>
      validateStartTraceInput({
        agentId: "a",
        metadata: { contents: "leak" },
      }),
    ).toThrow(/contents/);

    expect(() =>
      validateStartTraceInput({
        agentId: "a",
        metadata: { apiKey: "sk-test" },
      }),
    ).toThrow(/apiKey/);
  });
});

describe("normalizeTokenUsage / normalizeUsage", () => {
  it("derives totalTokens from input and output", () => {
    expect(normalizeTokenUsage({ inputTokens: 10, outputTokens: 5 })).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    });
    expect(normalizeUsage({ inputTokens: 10, outputTokens: 5 })).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    });
  });

  it("prefers supplied totalTokens", () => {
    expect(normalizeTokenUsage({ inputTokens: 10, outputTokens: 5, totalTokens: 99 })).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 99,
    });
  });

  it("leaves missing token fields undefined (never zeros them)", () => {
    expect(normalizeTokenUsage({ inputTokens: 7 })).toEqual({ inputTokens: 7 });
    expect(normalizeTokenUsage({ outputTokens: 3 })).toEqual({ outputTokens: 3 });
    expect(normalizeTokenUsage({})).toBeUndefined();
  });

  it("rejects negative token counts", () => {
    expect(() => normalizeTokenUsage({ inputTokens: -1 })).toThrow(/inputTokens/);
    expect(() => normalizeTokenUsage({ outputTokens: -2 })).toThrow(/outputTokens/);
    expect(() => normalizeTokenUsage({ totalTokens: -3 })).toThrow(/totalTokens/);
  });

  it("rejects non-integer token counts", () => {
    expect(() => normalizeTokenUsage({ inputTokens: 1.5 })).toThrow(ValidationError);
  });
});

describe("tags and metadata", () => {
  it("normalizes empty tags to undefined", () => {
    expect(normalizeTags([])).toBeUndefined();
  });

  it("rejects blank tags", () => {
    expect(() => normalizeTags(["ok", " "])).toThrow(/tags\[1\]/);
  });

  it("freezes metadata copies", () => {
    const original = { a: 1 };
    const normalized = normalizeMetadata(original);
    expect(normalized).toEqual({ a: 1 });
    expect(normalized).not.toBe(original);
    expect(Object.isFrozen(normalized)).toBe(true);
  });

  it("accepts and freezes metadata.usageDetails", () => {
    const normalized = normalizeMetadata({
      region: "us",
      usageDetails: {
        cachedInputTokens: 10,
        cacheWriteTokens: 2,
        reasoningTokens: 4,
      },
    });
    expect(normalized?.usageDetails).toEqual({
      cachedInputTokens: 10,
      cacheWriteTokens: 2,
      reasoningTokens: 4,
    });
    expect(Object.isFrozen(normalized?.usageDetails)).toBe(true);
  });

  it("rejects unknown usageDetails keys and content-like nesting abuse", () => {
    expect(() =>
      normalizeMetadata({
        usageDetails: { promptTokens: 1 },
      }),
    ).toThrow(/usageDetails/);

    expect(() =>
      normalizeMetadata({
        usageDetails: { cachedInputTokens: -1 },
      }),
    ).toThrow(/cachedInputTokens/);
  });
});

describe("error normalization", () => {
  it("normalizes Error instances without stacks", () => {
    const err = new Error("boom");
    err.name = "TypeError";
    const normalized = normalizeTraceError(err);
    expect(normalized).toEqual({
      name: "TypeError",
      message: "boom",
    });
    expect(normalized).not.toHaveProperty("stack");
  });

  it("extracts string code from Error-like objects", () => {
    const err = Object.assign(new Error("rate limited"), { code: "rate_limit_exceeded" });
    expect(normalizeTraceError(err)).toEqual({
      name: "Error",
      message: "rate limited",
      code: "rate_limit_exceeded",
    });
  });

  it("normalizes string errors", () => {
    expect(normalizeTraceError("nope")).toEqual({ name: "Error", message: "nope" });
  });

  it("ignores non-string payload fields on plain objects", () => {
    expect(
      normalizeTraceError({
        name: "APIError",
        message: "bad",
        code: "x",
        response: { body: "SECRET" },
        request: { messages: [] },
      }),
    ).toEqual({ name: "APIError", message: "bad", code: "x" });
  });

  it("supports fail input objects", () => {
    const result = validateFailTraceInput({
      error: new Error("failed"),
      inputTokens: 1,
      outputTokens: 2,
    });
    expect(result.error.message).toBe("failed");
    expect(result.usage).toEqual({
      inputTokens: 1,
      outputTokens: 2,
      totalTokens: 3,
    });
  });
});

describe("validateEndTraceInput", () => {
  it("accepts token fields", () => {
    expect(validateEndTraceInput({ inputTokens: 3, outputTokens: 4 }).usage).toEqual({
      inputTokens: 3,
      outputTokens: 4,
      totalTokens: 7,
    });
  });
});

describe("buildTraceEvent", () => {
  it("builds a frozen valid event", () => {
    const event = buildTraceEvent({
      eventId: "e1",
      traceId: "t1",
      agentId: "agent",
      startedAt: "2026-10-01T10:30:45.123Z",
      endedAt: "2026-10-01T10:30:46.123Z",
      latencyMs: 1000,
      status: "success",
      usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
      sdk: { name: "@agentgauge/node", version: "0.1.0" },
      tags: ["a"],
      metadata: { k: "v" },
    });

    expect(event.status).toBe("success");
    expect(Object.isFrozen(event)).toBe(true);
    expect(event.sdk).toEqual({ name: "@agentgauge/node", version: "0.1.0" });
  });

  it("builds anthropic and google style events", () => {
    const anthropic = buildTraceEvent({
      eventId: "a1",
      traceId: "a1",
      agentId: "support-agent",
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      operationName: "anthropic.messages.create",
      startedAt: "2026-10-01T10:30:45.123Z",
      endedAt: "2026-10-01T10:30:46.123Z",
      latencyMs: 100,
      status: "success",
      usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
      metadata: { usageDetails: { cachedInputTokens: 5 } },
      sdk: { name: "@agentgauge/node", version: "0.5.0" },
    });
    expect(anthropic.provider).toBe("anthropic");
    expect(anthropic.operationName).toBe("anthropic.messages.create");

    const google = buildTraceEvent({
      eventId: "g1",
      traceId: "g1",
      agentId: "support-agent",
      provider: "google",
      model: "gemini-2.5-flash",
      operationName: "google.models.generateContent",
      startedAt: "2026-10-01T10:30:45.123Z",
      endedAt: "2026-10-01T10:30:46.123Z",
      latencyMs: 80,
      status: "success",
      usage: { inputTokens: 8, outputTokens: 4, totalTokens: 12 },
      metadata: { usageDetails: { reasoningTokens: 2 } },
      sdk: { name: "@agentgauge/node", version: "0.5.0" },
    });
    expect(google.provider).toBe("google");
    expect(google.operationName).toBe("google.models.generateContent");
  });

  it("rejects negative latency", () => {
    expect(() =>
      buildTraceEvent({
        eventId: "e1",
        traceId: "t1",
        agentId: "agent",
        startedAt: "2026-10-01T10:30:45.123Z",
        endedAt: "2026-10-01T10:30:46.123Z",
        latencyMs: -1,
        status: "success",
        sdk: { name: "@agentgauge/node", version: "0.1.0" },
      }),
    ).toThrow(/latencyMs/);
  });

  it("includes optional runId, operationId, and attempt", () => {
    const event = buildTraceEvent({
      eventId: "e1",
      traceId: "t1",
      agentId: "agent",
      runId: "run_abc",
      operationId: "lookup_customer",
      attempt: 2,
      startedAt: "2026-10-01T10:30:45.123Z",
      endedAt: "2026-10-01T10:30:46.123Z",
      latencyMs: 10,
      status: "success",
      sdk: { name: "@agentgauge/node", version: "0.7.0" },
    });
    expect(event.runId).toBe("run_abc");
    expect(event.operationId).toBe("lookup_customer");
    expect(event.attempt).toBe(2);
  });

  it("omits run fields when absent (backward compatible)", () => {
    const event = buildTraceEvent({
      eventId: "e1",
      traceId: "t1",
      agentId: "agent",
      startedAt: "2026-10-01T10:30:45.123Z",
      endedAt: "2026-10-01T10:30:46.123Z",
      latencyMs: 10,
      status: "success",
      sdk: { name: "@agentgauge/node", version: "0.7.0" },
    });
    expect(event.runId).toBeUndefined();
    expect(event.operationId).toBeUndefined();
    expect(event.attempt).toBeUndefined();
  });
});

describe("validateStartTraceInput run fields", () => {
  it("accepts runId, operationId, and attempt", () => {
    const result = validateStartTraceInput({
      agentId: "support-agent",
      runId: "run_1",
      operationId: "lookup_customer",
      attempt: 1,
    });
    expect(result.runId).toBe("run_1");
    expect(result.operationId).toBe("lookup_customer");
    expect(result.attempt).toBe(1);
  });

  it("rejects attempt < 1", () => {
    expect(() => validateStartTraceInput({ agentId: "a", attempt: 0 })).toThrow(/attempt/);
  });
});

describe("validateStartRunInput / validateEndRunInput", () => {
  it("accepts valid start and end inputs", () => {
    expect(
      validateStartRunInput({
        name: "customer-support-request",
        agentId: "support-agent",
        metadata: { region: "us" },
      }),
    ).toMatchObject({
      name: "customer-support-request",
      agentId: "support-agent",
    });
    expect(validateEndRunInput({ status: "success" }).status).toBe("success");
    expect(validateEndRunInput({ status: "timeout" }).status).toBe("timeout");
  });

  it("rejects empty name and invalid end status", () => {
    expect(() => validateStartRunInput({ name: " ", agentId: "a" })).toThrow(/name/);
    expect(() => validateEndRunInput({ status: "running" as "success" })).toThrow(/status/);
  });

  it("rejects forbidden metadata on runs", () => {
    expect(() =>
      validateStartRunInput({
        name: "task",
        agentId: "a",
        metadata: { prompt: "secret" },
      }),
    ).toThrow(/prompt/);
  });
});
