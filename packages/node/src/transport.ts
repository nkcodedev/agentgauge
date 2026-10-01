import type { AgentGaugeMetadata, TerminalRunStatus, TraceEvent } from "@agentgauge/core";

export interface CreateRunPayload {
  readonly id: string;
  readonly name: string;
  readonly agentId: string;
  readonly project?: string;
  readonly metadata?: AgentGaugeMetadata;
  readonly startedAt: string;
}

export interface EndRunPayload {
  readonly status: TerminalRunStatus;
  readonly metadata?: AgentGaugeMetadata;
  readonly endedAt?: string;
}

/**
 * Minimal transport interface for emitting TraceEvents.
 * Implementations must treat send failures as delivery errors (not customer-path failures).
 */
export interface Transport {
  send(event: TraceEvent): Promise<void>;
  createRun?(payload: CreateRunPayload): Promise<void>;
  endRun?(runId: string, payload: EndRunPayload): Promise<void>;
  flush?(): Promise<void>;
  shutdown?(): Promise<void>;
}

/**
 * Optional callback invoked when a transport delivery attempt fails.
 * Must never throw into customer business logic (AgentGauge swallows callback errors).
 */
export type TransportErrorHandler = (error: unknown, event: TraceEvent) => void;
