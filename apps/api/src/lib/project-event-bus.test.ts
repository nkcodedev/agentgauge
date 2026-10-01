import { describe, expect, it, vi } from "vitest";
import { InMemoryProjectEventBus, type ProjectEvent } from "./project-event-bus.js";

function event(projectId: string, eventId = "e1"): ProjectEvent {
  return {
    type: "trace.created",
    projectId,
    agentId: "agent-a",
    eventId,
    occurredAt: "2026-10-01T00:00:00.000Z",
  };
}

describe("InMemoryProjectEventBus", () => {
  it("delivers events to project subscribers only", () => {
    const bus = new InMemoryProjectEventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.subscribe("proj-a", a);
    bus.subscribe("proj-b", b);

    bus.publish("proj-a", event("proj-a"));

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it("removes listeners on unsubscribe", () => {
    const bus = new InMemoryProjectEventBus();
    const listener = vi.fn();
    const unsubscribe = bus.subscribe("proj-a", listener);
    expect(bus.listenerCount("proj-a")).toBe(1);

    unsubscribe();
    expect(bus.listenerCount("proj-a")).toBe(0);

    bus.publish("proj-a", event("proj-a"));
    expect(listener).not.toHaveBeenCalled();
  });

  it("isolates listener errors from other subscribers", () => {
    const bus = new InMemoryProjectEventBus();
    const bad = vi.fn(() => {
      throw new Error("boom");
    });
    const good = vi.fn();
    bus.subscribe("proj-a", bad);
    bus.subscribe("proj-a", good);

    expect(() => bus.publish("proj-a", event("proj-a"))).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
  });
});
