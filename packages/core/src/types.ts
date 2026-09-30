/**
 * Outcome of a completed AgentGauge trace.
 */
export type TraceStatus = "success" | "error";

/**
 * Token usage associated with a trace.
 */
export interface TokenUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}

/**
 * Safe, sanitized error information attached to failed traces.
 * Must never contain secrets, prompts, or stack traces by default.
 */
export interface TraceError {
  readonly name?: string;
  readonly message?: string;
  readonly code?: string;
}

/**
 * User-supplied metadata bag. AgentGauge does not interpret keys.
 * Callers must not place secrets or raw prompts/completions here.
 */
export type AgentGaugeMetadata = Readonly<Record<string, unknown>>;

/**
 * SDK identity stamped onto every emitted event.
 */
export interface SdkInfo {
  readonly name: string;
  readonly version: string;
}

/**
 * Normalized AgentGauge telemetry event (V1).
 */
export interface TraceEvent {
  readonly eventId: string;
  readonly traceId: string;
  readonly agentId: string;
  readonly project?: string;
  readonly environment?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly operationName?: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly latencyMs: number;
  readonly status: TraceStatus;
  readonly usage?: TokenUsage;
  readonly error?: TraceError;
  readonly metadata?: AgentGaugeMetadata;
  readonly tags?: readonly string[];
  readonly sdk: SdkInfo;
}

/**
 * Inputs accepted when starting a manual trace.
 */
export interface StartTraceInput {
  readonly agentId: string;
  readonly project?: string;
  readonly environment?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly operationName?: string;
  readonly metadata?: AgentGaugeMetadata;
  readonly tags?: readonly string[];
  readonly traceId?: string;
}

/**
 * Inputs accepted when successfully ending a trace.
 */
export interface EndTraceInput {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
  readonly metadata?: AgentGaugeMetadata;
  readonly tags?: readonly string[];
  readonly provider?: string;
  readonly model?: string;
  readonly operationName?: string;
}

/**
 * Inputs accepted when failing a trace.
 * Prefer passing an `Error` (or unknown) to `fail()`; this shape is for normalized construction.
 */
export interface FailTraceInput {
  readonly error?: TraceError | Error | unknown;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
  readonly metadata?: AgentGaugeMetadata;
  readonly tags?: readonly string[];
  readonly provider?: string;
  readonly model?: string;
  readonly operationName?: string;
}

/**
 * Internal builder input for assembling a completed TraceEvent.
 */
export interface BuildTraceEventInput {
  readonly eventId: string;
  readonly traceId: string;
  readonly agentId: string;
  readonly project?: string;
  readonly environment?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly operationName?: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly latencyMs: number;
  readonly status: TraceStatus;
  readonly usage?: TokenUsage;
  readonly error?: TraceError;
  readonly metadata?: AgentGaugeMetadata;
  readonly tags?: readonly string[];
  readonly sdk: SdkInfo;
}
