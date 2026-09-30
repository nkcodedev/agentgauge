import type { BuildTraceEventInput, TraceEvent } from "./types.js";
import { assertNonNegativeLatency, normalizeMetadata, normalizeTags } from "./validation.js";
import { ValidationError } from "./errors.js";

/**
 * Builds an immutable TraceEvent from already-validated completion fields.
 */
export function buildTraceEvent(input: BuildTraceEventInput): TraceEvent {
  if (typeof input.eventId !== "string" || input.eventId.trim().length === 0) {
    throw new ValidationError("eventId must be a non-empty string");
  }
  if (typeof input.traceId !== "string" || input.traceId.trim().length === 0) {
    throw new ValidationError("traceId must be a non-empty string");
  }
  if (typeof input.agentId !== "string" || input.agentId.trim().length === 0) {
    throw new ValidationError("agentId must be a non-empty string");
  }
  if (typeof input.startedAt !== "string" || input.startedAt.trim().length === 0) {
    throw new ValidationError("startedAt must be a non-empty ISO-8601 string");
  }
  if (typeof input.endedAt !== "string" || input.endedAt.trim().length === 0) {
    throw new ValidationError("endedAt must be a non-empty ISO-8601 string");
  }
  if (input.status !== "success" && input.status !== "error") {
    throw new ValidationError('status must be "success" or "error"');
  }
  if (
    input.sdk === null ||
    typeof input.sdk !== "object" ||
    typeof input.sdk.name !== "string" ||
    input.sdk.name.trim().length === 0 ||
    typeof input.sdk.version !== "string" ||
    input.sdk.version.trim().length === 0
  ) {
    throw new ValidationError("sdk.name and sdk.version are required");
  }

  const latencyMs = assertNonNegativeLatency(input.latencyMs);
  const metadata = normalizeMetadata(input.metadata);
  const tags = normalizeTags(input.tags);

  const event: TraceEvent = {
    eventId: input.eventId.trim(),
    traceId: input.traceId.trim(),
    agentId: input.agentId.trim(),
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    latencyMs,
    status: input.status,
    sdk: Object.freeze({
      name: input.sdk.name.trim(),
      version: input.sdk.version.trim(),
    }),
    ...(input.project !== undefined ? { project: input.project } : {}),
    ...(input.environment !== undefined ? { environment: input.environment } : {}),
    ...(input.provider !== undefined ? { provider: input.provider } : {}),
    ...(input.model !== undefined ? { model: input.model } : {}),
    ...(input.operationName !== undefined ? { operationName: input.operationName } : {}),
    ...(input.usage !== undefined ? { usage: Object.freeze({ ...input.usage }) } : {}),
    ...(input.error !== undefined ? { error: Object.freeze({ ...input.error }) } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
    ...(tags !== undefined ? { tags } : {}),
  };

  return Object.freeze(event);
}
