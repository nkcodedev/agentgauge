import { describe, expect, it } from "vitest";
import { generateApiKey, hashApiKey, parseBearerToken, safeEqualHex } from "./api-keys.js";
import { InMemoryRateLimiter } from "./rate-limit.js";
import { IngestBodySchema, TraceEventSchema } from "./trace-schema.js";

describe("api-keys", () => {
  it("generates ag_live_ / ag_test_ keys and hashes stably", () => {
    const live = generateApiKey("live");
    expect(live.plaintext.startsWith("ag_live_")).toBe(true);
    expect(hashApiKey(live.plaintext)).toBe(live.hash);
    expect(live.hash).not.toBe(live.plaintext);

    const test = generateApiKey("test");
    expect(test.plaintext.startsWith("ag_test_")).toBe(true);
  });

  it("parses bearer tokens", () => {
    expect(parseBearerToken("Bearer abc")).toBe("abc");
    expect(parseBearerToken(undefined)).toBeUndefined();
  });

  it("compares hashes safely", () => {
    const a = hashApiKey("ag_live_x");
    expect(safeEqualHex(a, a)).toBe(true);
    expect(safeEqualHex(a, hashApiKey("ag_live_y"))).toBe(false);
  });
});

describe("rate limiter", () => {
  it("limits within a window", () => {
    const limiter = new InMemoryRateLimiter(2, 60_000);
    expect(limiter.check("k").allowed).toBe(true);
    expect(limiter.check("k").allowed).toBe(true);
    expect(limiter.check("k").allowed).toBe(false);
  });
});

describe("trace schema", () => {
  const valid = {
    eventId: "e1",
    traceId: "t1",
    agentId: "a1",
    startedAt: "2024-01-01T00:00:00.000Z",
    endedAt: "2024-01-01T00:00:01.000Z",
    latencyMs: 1000,
    status: "success",
    sdk: { name: "@agentgauge/node", version: "0.3.0" },
  };

  it("accepts a valid event", () => {
    expect(TraceEventSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects deep metadata", () => {
    const result = TraceEventSchema.safeParse({
      ...valid,
      metadata: { a: { b: { c: { d: 1 } } } },
    });
    expect(result.success).toBe(false);
  });

  it("enforces batch max size", () => {
    const events = Array.from({ length: 101 }, (_, i) => ({
      ...valid,
      eventId: `e${i}`,
      traceId: `t${i}`,
    }));
    expect(IngestBodySchema.safeParse({ events }).success).toBe(false);
  });
});
