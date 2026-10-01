import { afterEach, describe, expect, it, vi } from "vitest";
import type { TraceEvent } from "@agentgauge/core";
import { BatchedTransport } from "./batched-transport.js";
import { SDK_NAME, SDK_VERSION } from "./version.js";

function event(id: string): TraceEvent {
  return {
    eventId: id,
    traceId: id,
    agentId: "a",
    startedAt: "2026-10-01T00:00:00.000Z",
    endedAt: "2026-10-01T00:00:00.010Z",
    latencyMs: 10,
    status: "success",
    sdk: { name: SDK_NAME, version: SDK_VERSION },
  };
}

describe("BatchedTransport", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("flushes when batch size is reached", async () => {
    const sent: TraceEvent[] = [];
    const batch = new BatchedTransport({
      maxBatchSize: 2,
      flushIntervalMs: 0,
      transport: {
        async send(e) {
          sent.push(e);
        },
      },
    });

    await batch.send(event("1"));
    expect(sent).toHaveLength(0);
    await batch.send(event("2"));
    expect(sent.map((e) => e.eventId)).toEqual(["1", "2"]);
  });

  it("flushes on interval", async () => {
    vi.useFakeTimers();
    const sent: TraceEvent[] = [];
    const batch = new BatchedTransport({
      maxBatchSize: 10,
      flushIntervalMs: 100,
      transport: {
        async send(e) {
          sent.push(e);
        },
      },
    });

    await batch.send(event("1"));
    expect(sent).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(sent).toHaveLength(1);
    await batch.shutdown();
  });

  it("flushes remaining events on shutdown", async () => {
    const sent: TraceEvent[] = [];
    const batch = new BatchedTransport({
      maxBatchSize: 10,
      flushIntervalMs: 0,
      transport: {
        async send(e) {
          sent.push(e);
        },
      },
    });
    await batch.send(event("1"));
    await batch.shutdown();
    expect(sent).toHaveLength(1);
  });
});
