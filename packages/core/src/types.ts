/**
 * Outcome of a completed AgentGauge trace.
 */
export type TraceStatus = "success" | "error";

/**
 * Token usage associated with a trace.
 *
 * Provider-neutral naming (do not use promptTokens/completionTokens as first-class fields):
 * - inputTokens — normalized input/prompt tokens
 * - outputTokens — normalized output/completion tokens
 * - totalTokens — provider total when valid, else derived as input+output when both known
 *
 * Supplemental provider-specific counts (cache, reasoning) belong in
 * `metadata.usageDetails` — see UsageDetails in providers.ts — not here.
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
 * User-supplied metadata bag. AgentGauge does not interpret most keys.
 * Callers must not place secrets or raw prompts/completions here.
 *
 * Optional convention for provider adapters:
 * `{ usageDetails?: { cachedInputTokens?, cacheWriteTokens?, reasoningTokens? } }`
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
 * Explicit run/task outcome. Declared by the application — not inferred from child traces.
 */
export type RunStatus = "running" | "success" | "error" | "cancelled" | "timeout";

/** Terminal run statuses (cannot return to running). */
export const TERMINAL_RUN_STATUSES = ["success", "error", "cancelled", "timeout"] as const;
export type TerminalRunStatus = (typeof TERMINAL_RUN_STATUSES)[number];

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
  /**
   * Optional association with a logical run/task.
   * Absent → standalone request-level trace (backward compatible).
   */
  readonly runId?: string;
  /** Optional logical operation within a run (groups retries). */
  readonly operationId?: string;
  /** Optional 1-based retry attempt for the same operationId. */
  readonly attempt?: number;
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
  readonly runId?: string;
  readonly operationId?: string;
  readonly attempt?: number;
  readonly metadata?: AgentGaugeMetadata;
  readonly tags?: readonly string[];
  readonly traceId?: string;
}

/**
 * Inputs accepted when starting a run/task.
 */
export interface StartRunInput {
  readonly name: string;
  readonly agentId: string;
  readonly project?: string;
  readonly metadata?: AgentGaugeMetadata;
  /** Optional client-supplied run id; otherwise generated. */
  readonly runId?: string;
}

/**
 * Inputs accepted when ending a run/task.
 */
export interface EndRunInput {
  readonly status: TerminalRunStatus;
  readonly metadata?: AgentGaugeMetadata;
  readonly endedAt?: string;
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
  readonly runId?: string;
  readonly operationId?: string;
  readonly attempt?: number;
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
