import { describe, expect, it } from "vitest";
import {
  AgentGaugeError,
  ConfigurationError,
  ValidationError,
  buildTraceEvent,
  normalizeMetadata,
  normalizeTags,
  normalizeTokenUsage,
  normalizeTraceError,
  validateEndTraceInput,
  validateFailTraceInput,
  validateStartTraceInput,
} from "./index.js";

describe("errors", () => {
  it("exposes typed error codes", () => {
    expect(new ValidationError("bad").code).toBe("validation_error");
    expect(new ConfigurationError("cfg").code).toBe("configuration_error");
    expect(new AgentGaugeError("x").code).toBe("agentgauge_error");
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
  });
});

describe("normalizeTokenUsage", () => {
  it("derives totalTokens from input and output", () => {
    expect(normalizeTokenUsage({ inputTokens: 10, outputTokens: 5 })).toEqual({
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
});

describe("error normalization", () => {
  it("normalizes Error instances", () => {
    const err = new Error("boom");
    err.name = "TypeError";
    expect(normalizeTraceError(err)).toEqual({
      name: "TypeError",
      message: "boom",
    });
  });

  it("normalizes string errors", () => {
    expect(normalizeTraceError("nope")).toEqual({ name: "Error", message: "nope" });
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
});
