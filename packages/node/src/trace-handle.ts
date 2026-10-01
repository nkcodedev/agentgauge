import {
  ConfigurationError,
  buildTraceEvent,
  validateEndTraceInput,
  validateFailTraceInput,
  type AgentGaugeMetadata,
  type BuildTraceEventInput,
  type EndTraceInput,
  type FailTraceInput,
  type TraceEvent,
} from "@agentgauge/core";
import type { CreateRunPayload, EndRunPayload } from "./transport.js";
import { SDK_NAME, SDK_VERSION } from "./version.js";

/**
 * Handle returned by AgentGauge.startTrace().
 */
export interface TraceHandle {
  readonly eventId: string;
  readonly traceId: string;
  /**
   * Completes the trace successfully.
   * Transport delivery failures are swallowed (best-effort telemetry).
   * Calling end()/fail() twice throws ConfigurationError (SDK misuse).
   */
  end(input?: EndTraceInput): void;
  /**
   * Completes the trace as an error.
   * Accepts an Error, unknown throw value, or FailTraceInput.
   * Transport delivery failures are swallowed (best-effort telemetry).
   */
  fail(error?: FailTraceInput | Error | unknown): void;
}

interface TraceContext {
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
  readonly metadata?: AgentGaugeMetadata;
  readonly tags?: readonly string[];
  readonly startedAt: string;
  readonly startHrTime: bigint;
}

export interface TraceEmitter {
  emit(event: TraceEvent): void;
  assertNotShutdown(): void;
  /** Best-effort create; queued like emit. */
  createRun(payload: CreateRunPayload): void;
  /** Awaited end. */
  endRun(runId: string, payload: EndRunPayload): Promise<void>;
}

function mergeMetadata(
  base: AgentGaugeMetadata | undefined,
  extra: AgentGaugeMetadata | undefined,
): AgentGaugeMetadata | undefined {
  if (base === undefined && extra === undefined) {
    return undefined;
  }
  return Object.freeze({ ...(base ?? {}), ...(extra ?? {}) });
}

function mergeTags(
  base: readonly string[] | undefined,
  extra: readonly string[] | undefined,
): readonly string[] | undefined {
  if (base === undefined && extra === undefined) {
    return undefined;
  }
  if (base === undefined) {
    return extra;
  }
  if (extra === undefined) {
    return base;
  }
  return Object.freeze([...base, ...extra]);
}

function computeLatencyMs(startHrTime: bigint): number {
  const diffNs = process.hrtime.bigint() - startHrTime;
  const ms = Number(diffNs) / 1_000_000;
  return Math.max(0, Math.round(ms));
}

function withOptionalString(
  key: "project" | "environment" | "provider" | "model" | "operationName" | "runId" | "operationId",
  value: string | undefined,
): Partial<BuildTraceEventInput> {
  if (value === undefined) {
    return {};
  }
  return { [key]: value };
}

function withOptionalAttempt(value: number | undefined): Partial<BuildTraceEventInput> {
  if (value === undefined) {
    return {};
  }
  return { attempt: value };
}

export class ManualTraceHandle implements TraceHandle {
  readonly eventId: string;
  readonly traceId: string;

  private finished = false;
  private readonly ctx: TraceContext;
  private readonly emitter: TraceEmitter;

  constructor(ctx: TraceContext, emitter: TraceEmitter) {
    this.ctx = ctx;
    this.emitter = emitter;
    this.eventId = ctx.eventId;
    this.traceId = ctx.traceId;
  }

  end(input?: EndTraceInput): void {
    this.complete("success", validateEndTraceInput(input));
  }

  fail(error?: FailTraceInput | Error | unknown): void {
    const validated = validateFailTraceInput(error ?? new Error("Unknown error"));
    this.complete("error", validated);
  }

  private complete(
    status: "success" | "error",
    validated: {
      usage?: ReturnType<typeof validateEndTraceInput>["usage"];
      metadata?: AgentGaugeMetadata;
      tags?: readonly string[];
      provider?: string;
      model?: string;
      operationName?: string;
      error?: ReturnType<typeof validateFailTraceInput>["error"];
    },
  ): void {
    this.emitter.assertNotShutdown();
    if (this.finished) {
      throw new ConfigurationError("Trace has already been completed");
    }
    this.finished = true;

    const endedAt = new Date().toISOString();
    const latencyMs = computeLatencyMs(this.ctx.startHrTime);
    const metadata = mergeMetadata(this.ctx.metadata, validated.metadata);
    const tags = mergeTags(this.ctx.tags, validated.tags);

    const input: BuildTraceEventInput = {
      eventId: this.ctx.eventId,
      traceId: this.ctx.traceId,
      agentId: this.ctx.agentId,
      startedAt: this.ctx.startedAt,
      endedAt,
      latencyMs,
      status,
      sdk: { name: SDK_NAME, version: SDK_VERSION },
      ...withOptionalString("project", this.ctx.project),
      ...withOptionalString("environment", this.ctx.environment),
      ...withOptionalString("provider", validated.provider ?? this.ctx.provider),
      ...withOptionalString("model", validated.model ?? this.ctx.model),
      ...withOptionalString("operationName", validated.operationName ?? this.ctx.operationName),
      ...withOptionalString("runId", this.ctx.runId),
      ...withOptionalString("operationId", this.ctx.operationId),
      ...withOptionalAttempt(this.ctx.attempt),
      ...(validated.usage !== undefined ? { usage: validated.usage } : {}),
      ...(status === "error" && validated.error !== undefined ? { error: validated.error } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
      ...(tags !== undefined ? { tags } : {}),
    };

    this.emitter.emit(buildTraceEvent(input));
  }
}

export function createTraceContext(input: {
  agentId: string;
  project?: string;
  environment?: string;
  provider?: string;
  model?: string;
  operationName?: string;
  runId?: string;
  operationId?: string;
  attempt?: number;
  metadata?: AgentGaugeMetadata;
  tags?: readonly string[];
  traceId?: string;
}): TraceContext {
  const eventId = crypto.randomUUID();
  const traceId = input.traceId ?? eventId;
  const startedAt = new Date().toISOString();

  return {
    eventId,
    traceId,
    agentId: input.agentId,
    startedAt,
    startHrTime: process.hrtime.bigint(),
    ...withOptionalString("project", input.project),
    ...withOptionalString("environment", input.environment),
    ...withOptionalString("provider", input.provider),
    ...withOptionalString("model", input.model),
    ...withOptionalString("operationName", input.operationName),
    ...withOptionalString("runId", input.runId),
    ...withOptionalString("operationId", input.operationId),
    ...withOptionalAttempt(input.attempt),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
  };
}
