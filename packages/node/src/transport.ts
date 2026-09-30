import type { TraceEvent } from "@agentgauge/core";

/**
 * Minimal transport interface for emitting TraceEvents.
 * Implementations must treat send failures as delivery errors (not customer-path failures).
 */
export interface Transport {
  send(event: TraceEvent): Promise<void>;
  flush?(): Promise<void>;
  shutdown?(): Promise<void>;
}

/**
 * Optional callback invoked when a transport delivery attempt fails.
 * Must never throw into customer business logic (AgentGauge swallows callback errors).
 */
export type TransportErrorHandler = (error: unknown, event: TraceEvent) => void;
