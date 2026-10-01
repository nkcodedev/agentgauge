"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

export type LiveConnectionStatus = "connecting" | "live" | "reconnecting" | "offline";

export interface TraceCreatedEvent {
  readonly type: "trace.created";
  readonly projectId: string;
  readonly agentId: string;
  readonly eventId: string;
  readonly occurredAt: string;
}

/** Debounce window for coalescing bursty telemetry into a single refetch. */
export const LIVE_REFRESH_DEBOUNCE_MS = 500;

interface LiveEventsContextValue {
  readonly status: LiveConnectionStatus;
}

const LiveEventsContext = createContext<LiveEventsContextValue>({ status: "connecting" });

export function useLiveConnectionStatus(): LiveConnectionStatus {
  return useContext(LiveEventsContext).status;
}

/**
 * Shared SSE connection for the dashboard shell.
 * On `trace.created`, debounces `router.refresh()` so RSC pages refetch canonical APIs
 * without resetting URL filters/search params.
 */
export function LiveEventsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<LiveConnectionStatus>("connecting");
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      router.refresh();
    }, LIVE_REFRESH_DEBOUNCE_MS);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    let reconnectAttempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      if (typeof EventSource === "undefined") {
        setStatus("offline");
        return;
      }
      setStatus(reconnectAttempts === 0 ? "connecting" : "reconnecting");
      const source = new EventSource("/api/events");
      sourceRef.current = source;

      source.addEventListener("ready", () => {
        if (cancelled) return;
        reconnectAttempts = 0;
        setStatus("live");
      });

      source.addEventListener("trace.created", () => {
        if (cancelled) return;
        setStatus("live");
        scheduleRefresh();
      });

      source.onerror = () => {
        if (cancelled) return;
        source.close();
        sourceRef.current = null;
        setStatus(reconnectAttempts > 2 ? "offline" : "reconnecting");
        reconnectAttempts += 1;
        const delay = Math.min(8_000, 500 * 2 ** Math.min(reconnectAttempts, 4));
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [scheduleRefresh]);

  const value = useMemo(() => ({ status }), [status]);
  return <LiveEventsContext.Provider value={value}>{children}</LiveEventsContext.Provider>;
}

/** Test helper: coalesce many events into one refresh callback. */
export function createDebouncedRefresh(
  refresh: () => void,
  debounceMs = LIVE_REFRESH_DEBOUNCE_MS,
): { notify: () => void; dispose: () => void; pending: () => boolean } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    notify() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        refresh();
      }, debounceMs);
    },
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
    pending() {
      return timer !== null;
    },
  };
}
