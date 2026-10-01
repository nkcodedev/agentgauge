import { describe, expect, it, vi } from "vitest";
import {
  createDebouncedRefresh,
  LIVE_REFRESH_DEBOUNCE_MS,
  LIVE_SSE_REFRESH_EVENTS,
  LiveEventsProvider,
} from "./live-events";
import { render, screen } from "@testing-library/react";
import { LiveIndicator } from "./live-indicator";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/overview",
}));

describe("LIVE_SSE_REFRESH_EVENTS", () => {
  it("includes run lifecycle events", () => {
    expect(LIVE_SSE_REFRESH_EVENTS).toContain("trace.created");
    expect(LIVE_SSE_REFRESH_EVENTS).toContain("run.created");
    expect(LIVE_SSE_REFRESH_EVENTS).toContain("run.updated");
  });
});

describe("createDebouncedRefresh", () => {
  it("coalesces bursts into a single refresh", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const debounced = createDebouncedRefresh(refresh, LIVE_REFRESH_DEBOUNCE_MS);

    for (let i = 0; i < 25; i++) debounced.notify();
    expect(refresh).not.toHaveBeenCalled();
    expect(debounced.pending()).toBe(true);

    await vi.advanceTimersByTimeAsync(LIVE_REFRESH_DEBOUNCE_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
    debounced.dispose();
    vi.useRealTimers();
  });
});

describe("LiveIndicator", () => {
  it("renders connection status from context", () => {
    class FakeEventSource {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 2;
      readyState = FakeEventSource.CONNECTING;
      onerror: ((ev: Event) => void) | null = null;
      addEventListener() {
        // no-op: indicator still mounts with connecting/offline status
      }
      close() {
        this.readyState = FakeEventSource.CLOSED;
      }
    }
    vi.stubGlobal("EventSource", FakeEventSource);

    render(
      <LiveEventsProvider>
        <LiveIndicator />
      </LiveEventsProvider>,
    );
    const el = screen.getByTestId("live-indicator");
    expect(el).toBeInTheDocument();
    expect(["connecting", "live", "reconnecting", "offline"]).toContain(
      el.getAttribute("data-status"),
    );
    vi.unstubAllGlobals();
  });
});
