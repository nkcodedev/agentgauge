import { ValidationError } from "./errors.js";
import type {
  AgentGaugeMetadata,
  EndRunInput,
  EndTraceInput,
  FailTraceInput,
  StartRunInput,
  StartTraceInput,
  TokenUsage,
  TraceError,
} from "./types.js";
import { USAGE_DETAILS_KEYS, type UsageDetails } from "./providers.js";

/**
 * Top-level metadata keys that typically carry prompt/completion content or secrets.
 * Operational keys (region, usageDetails, etc.) remain allowed.
 */
export const FORBIDDEN_METADATA_CONTENT_KEYS = Object.freeze([
  "prompt",
  "prompts",
  "completion",
  "completions",
  "message",
  "messages",
  "content",
  "contents",
  "input",
  "output",
  "system",
  "systemPrompt",
  "toolArguments",
  "toolOutput",
  "request",
  "response",
  "rawRequest",
  "rawResponse",
  "responseBody",
  "response_body",
  "apiKey",
  "authorization",
] as const);

const FORBIDDEN_CONTENT_KEYS = new Set<string>(FORBIDDEN_METADATA_CONTENT_KEYS);
const USAGE_DETAILS_KEY_SET = new Set<string>(USAGE_DETAILS_KEYS);

function assertNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function assertOptionalNonEmptyString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return assertNonEmptyString(value, field);
}

function assertNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new ValidationError(`${field} must be a finite integer`);
  }
  if (value < 0) {
    throw new ValidationError(`${field} must not be negative`);
  }
  return value;
}

function assertOptionalNonNegativeInteger(value: unknown, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return assertNonNegativeInteger(value, field);
}

function isFailTraceInputObject(value: unknown): value is FailTraceInput {
  if (value === null || typeof value !== "object" || value instanceof Error) {
    return false;
  }
  const keys = Object.keys(value);
  if (keys.length === 0) {
    return true;
  }
  const allowed = new Set([
    "error",
    "inputTokens",
    "outputTokens",
    "totalTokens",
    "metadata",
    "tags",
    "provider",
    "model",
    "operationName",
  ]);
  return keys.every((key) => allowed.has(key));
}

/**
 * Validates optional metadata.usageDetails (numeric operational extras only).
 */
function normalizeUsageDetails(value: unknown): UsageDetails | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("metadata.usageDetails must be a plain object");
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!USAGE_DETAILS_KEY_SET.has(key)) {
      throw new ValidationError(
        `metadata.usageDetails key "${key}" is not supported; allowed: ${USAGE_DETAILS_KEYS.join(", ")}`,
      );
    }
  }

  const cachedInputTokens = assertOptionalNonNegativeInteger(
    record.cachedInputTokens,
    "metadata.usageDetails.cachedInputTokens",
  );
  const cacheWriteTokens = assertOptionalNonNegativeInteger(
    record.cacheWriteTokens,
    "metadata.usageDetails.cacheWriteTokens",
  );
  const reasoningTokens = assertOptionalNonNegativeInteger(
    record.reasoningTokens,
    "metadata.usageDetails.reasoningTokens",
  );

  if (
    cachedInputTokens === undefined &&
    cacheWriteTokens === undefined &&
    reasoningTokens === undefined
  ) {
    return undefined;
  }

  const details: {
    cachedInputTokens?: number;
    cacheWriteTokens?: number;
    reasoningTokens?: number;
  } = {};
  if (cachedInputTokens !== undefined) details.cachedInputTokens = cachedInputTokens;
  if (cacheWriteTokens !== undefined) details.cacheWriteTokens = cacheWriteTokens;
  if (reasoningTokens !== undefined) details.reasoningTokens = reasoningTokens;
  return Object.freeze(details);
}

/**
 * Validates and shallow-freezes user metadata.
 * Rejects known content-capture keys that are unsupported in V1.
 * Normalizes optional `usageDetails` when present.
 */
export function normalizeMetadata(
  metadata: AgentGaugeMetadata | undefined,
): AgentGaugeMetadata | undefined {
  if (metadata === undefined) {
    return undefined;
  }
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new ValidationError("metadata must be a plain object");
  }

  for (const key of Object.keys(metadata)) {
    if (FORBIDDEN_CONTENT_KEYS.has(key)) {
      throw new ValidationError(
        `metadata key "${key}" is not supported; AgentGauge does not capture prompts/completions by default`,
      );
    }
  }

  const usageDetails = normalizeUsageDetails(metadata.usageDetails);
  const copy: Record<string, unknown> = { ...metadata };
  if (usageDetails === undefined) {
    delete copy.usageDetails;
  } else {
    copy.usageDetails = usageDetails;
  }

  if (Object.keys(copy).length === 0) {
    return undefined;
  }

  return Object.freeze(copy);
}

/**
 * Validates tags: non-empty strings only. Empty arrays become undefined.
 */
export function normalizeTags(tags: readonly string[] | undefined): readonly string[] | undefined {
  if (tags === undefined) {
    return undefined;
  }
  if (!Array.isArray(tags)) {
    throw new ValidationError("tags must be an array of strings");
  }
  if (tags.length === 0) {
    return undefined;
  }

  const normalized = tags.map((tag, index) => {
    if (typeof tag !== "string" || tag.trim().length === 0) {
      throw new ValidationError(`tags[${index}] must be a non-empty string`);
    }
    return tag.trim();
  });

  return Object.freeze(normalized);
}

/**
 * Normalizes token usage and derives totalTokens when both parts exist and total is omitted.
 *
 * Rules:
 * 1. Keep provider-reported totalTokens when valid.
 * 2. Else if both inputTokens and outputTokens are known, totalTokens = sum.
 * 3. Missing fields stay undefined (never coerced to 0).
 * 4. Reject negative / non-finite / non-integer values.
 */
export function normalizeTokenUsage(input: {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}): TokenUsage | undefined {
  const inputTokens = assertOptionalNonNegativeInteger(input.inputTokens, "inputTokens");
  const outputTokens = assertOptionalNonNegativeInteger(input.outputTokens, "outputTokens");
  let totalTokens = assertOptionalNonNegativeInteger(input.totalTokens, "totalTokens");

  if (totalTokens === undefined && inputTokens !== undefined && outputTokens !== undefined) {
    totalTokens = inputTokens + outputTokens;
  }

  if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) {
    return undefined;
  }

  const usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  } = {};

  if (inputTokens !== undefined) {
    usage.inputTokens = inputTokens;
  }
  if (outputTokens !== undefined) {
    usage.outputTokens = outputTokens;
  }
  if (totalTokens !== undefined) {
    usage.totalTokens = totalTokens;
  }

  return Object.freeze(usage);
}

/** Alias for {@link normalizeTokenUsage} — preferred name in multi-provider docs. */
export const normalizeUsage = normalizeTokenUsage;

/**
 * Validates start-trace developer inputs (does not generate IDs or timestamps).
 */
export function validateStartTraceInput(input: StartTraceInput): {
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
} {
  if (input === null || typeof input !== "object") {
    throw new ValidationError("startTrace input must be an object");
  }

  const agentId = assertNonEmptyString(input.agentId, "agentId");
  const project = assertOptionalNonEmptyString(input.project, "project");
  const environment = assertOptionalNonEmptyString(input.environment, "environment");
  const provider = assertOptionalNonEmptyString(input.provider, "provider");
  const model = assertOptionalNonEmptyString(input.model, "model");
  const operationName = assertOptionalNonEmptyString(input.operationName, "operationName");
  const runId = assertOptionalNonEmptyString(input.runId, "runId");
  const operationId = assertOptionalNonEmptyString(input.operationId, "operationId");
  const traceId = assertOptionalNonEmptyString(input.traceId, "traceId");
  const metadata = normalizeMetadata(input.metadata);
  const tags = normalizeTags(input.tags);

  let attempt: number | undefined;
  if (input.attempt !== undefined) {
    if (
      typeof input.attempt !== "number" ||
      !Number.isInteger(input.attempt) ||
      input.attempt < 1 ||
      input.attempt > 1_000_000
    ) {
      throw new ValidationError("attempt must be an integer >= 1");
    }
    attempt = input.attempt;
  }

  const result: {
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
  } = { agentId };

  if (project !== undefined) result.project = project;
  if (environment !== undefined) result.environment = environment;
  if (provider !== undefined) result.provider = provider;
  if (model !== undefined) result.model = model;
  if (operationName !== undefined) result.operationName = operationName;
  if (runId !== undefined) result.runId = runId;
  if (operationId !== undefined) result.operationId = operationId;
  if (attempt !== undefined) result.attempt = attempt;
  if (traceId !== undefined) result.traceId = traceId;
  if (metadata !== undefined) result.metadata = metadata;
  if (tags !== undefined) result.tags = tags;

  return result;
}

const TERMINAL_STATUSES = new Set(["success", "error", "cancelled", "timeout"]);

/**
 * Validates start-run developer inputs.
 */
export function validateStartRunInput(input: StartRunInput): {
  name: string;
  agentId: string;
  project?: string;
  metadata?: AgentGaugeMetadata;
  runId?: string;
} {
  if (input === null || typeof input !== "object") {
    throw new ValidationError("startRun input must be an object");
  }
  const name = assertNonEmptyString(input.name, "name");
  if (name.length > 256) {
    throw new ValidationError("name must be at most 256 characters");
  }
  const agentId = assertNonEmptyString(input.agentId, "agentId");
  const project = assertOptionalNonEmptyString(input.project, "project");
  const runId = assertOptionalNonEmptyString(input.runId, "runId");
  const metadata = normalizeMetadata(input.metadata);

  const result: {
    name: string;
    agentId: string;
    project?: string;
    metadata?: AgentGaugeMetadata;
    runId?: string;
  } = { name, agentId };
  if (project !== undefined) result.project = project;
  if (runId !== undefined) result.runId = runId;
  if (metadata !== undefined) result.metadata = metadata;
  return result;
}

/**
 * Validates end-run developer inputs.
 */
export function validateEndRunInput(input: EndRunInput): {
  status: "success" | "error" | "cancelled" | "timeout";
  metadata?: AgentGaugeMetadata;
  endedAt?: string;
} {
  if (input === null || typeof input !== "object") {
    throw new ValidationError("endRun input must be an object");
  }
  if (typeof input.status !== "string" || !TERMINAL_STATUSES.has(input.status)) {
    throw new ValidationError(
      'status must be one of "success", "error", "cancelled", or "timeout"',
    );
  }
  const metadata = normalizeMetadata(input.metadata);
  const endedAt = assertOptionalNonEmptyString(input.endedAt, "endedAt");
  const result: {
    status: "success" | "error" | "cancelled" | "timeout";
    metadata?: AgentGaugeMetadata;
    endedAt?: string;
  } = { status: input.status as "success" | "error" | "cancelled" | "timeout" };
  if (metadata !== undefined) result.metadata = metadata;
  if (endedAt !== undefined) result.endedAt = endedAt;
  return result;
}

/**
 * Validates end-trace inputs.
 */
export function validateEndTraceInput(input: EndTraceInput | undefined): {
  usage?: TokenUsage;
  metadata?: AgentGaugeMetadata;
  tags?: readonly string[];
  provider?: string;
  model?: string;
  operationName?: string;
} {
  if (input === undefined) {
    return {};
  }
  if (input === null || typeof input !== "object") {
    throw new ValidationError("end() input must be an object");
  }

  const usage = normalizeTokenUsage(input);
  const metadata = normalizeMetadata(input.metadata);
  const tags = normalizeTags(input.tags);
  const provider = assertOptionalNonEmptyString(input.provider, "provider");
  const model = assertOptionalNonEmptyString(input.model, "model");
  const operationName = assertOptionalNonEmptyString(input.operationName, "operationName");

  const result: {
    usage?: TokenUsage;
    metadata?: AgentGaugeMetadata;
    tags?: readonly string[];
    provider?: string;
    model?: string;
    operationName?: string;
  } = {};

  if (usage !== undefined) result.usage = usage;
  if (metadata !== undefined) result.metadata = metadata;
  if (tags !== undefined) result.tags = tags;
  if (provider !== undefined) result.provider = provider;
  if (model !== undefined) result.model = model;
  if (operationName !== undefined) result.operationName = operationName;

  return result;
}

/**
 * Converts unknown thrown values into a sanitized TraceError.
 * Never copies stacks, request/response bodies, or provider payloads.
 */
export function normalizeTraceError(error: unknown): TraceError {
  if (error === undefined || error === null) {
    return Object.freeze({ name: "Error", message: "Unknown error" });
  }

  if (typeof error === "string") {
    const message = error.trim().length > 0 ? error.trim() : "Unknown error";
    return Object.freeze({ name: "Error", message });
  }

  if (error instanceof Error) {
    const result: { name?: string; message?: string; code?: string } = {
      name: error.name || "Error",
      message: error.message || "Unknown error",
    };
    const withCode = error as Error & { code?: unknown };
    if (typeof withCode.code === "string" && withCode.code.trim().length > 0) {
      result.code = withCode.code.trim();
    }
    return Object.freeze(result);
  }

  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    const result: { name?: string; message?: string; code?: string } = {};
    if (typeof record.name === "string" && record.name.trim().length > 0) {
      result.name = record.name.trim();
    }
    if (typeof record.message === "string" && record.message.trim().length > 0) {
      result.message = record.message.trim();
    }
    if (typeof record.code === "string" && record.code.trim().length > 0) {
      result.code = record.code.trim();
    }
    if (result.name === undefined && result.message === undefined && result.code === undefined) {
      return Object.freeze({ name: "Error", message: "Unknown error" });
    }
    if (result.name === undefined) {
      result.name = "Error";
    }
    if (result.message === undefined) {
      result.message = "Unknown error";
    }
    return Object.freeze(result);
  }

  return Object.freeze({ name: "Error", message: "Unknown error" });
}

/**
 * Validates fail-trace inputs and normalizes the error payload.
 * Accepts either a FailTraceInput object or a raw Error/unknown for `fail(error)`.
 */
export function validateFailTraceInput(input: FailTraceInput | Error | unknown): {
  error: TraceError;
  usage?: TokenUsage;
  metadata?: AgentGaugeMetadata;
  tags?: readonly string[];
  provider?: string;
  model?: string;
  operationName?: string;
} {
  if (isFailTraceInputObject(input)) {
    const usage = normalizeTokenUsage(input);
    const metadata = normalizeMetadata(input.metadata);
    const tags = normalizeTags(input.tags);
    const provider = assertOptionalNonEmptyString(input.provider, "provider");
    const model = assertOptionalNonEmptyString(input.model, "model");
    const operationName = assertOptionalNonEmptyString(input.operationName, "operationName");

    const result: {
      error: TraceError;
      usage?: TokenUsage;
      metadata?: AgentGaugeMetadata;
      tags?: readonly string[];
      provider?: string;
      model?: string;
      operationName?: string;
    } = {
      error: normalizeTraceError(input.error ?? new Error("Unknown error")),
    };

    if (usage !== undefined) result.usage = usage;
    if (metadata !== undefined) result.metadata = metadata;
    if (tags !== undefined) result.tags = tags;
    if (provider !== undefined) result.provider = provider;
    if (model !== undefined) result.model = model;
    if (operationName !== undefined) result.operationName = operationName;
    return result;
  }

  return { error: normalizeTraceError(input) };
}

/**
 * Ensures latency is a non-negative finite number.
 */
export function assertNonNegativeLatency(latencyMs: number): number {
  if (typeof latencyMs !== "number" || !Number.isFinite(latencyMs)) {
    throw new ValidationError("latencyMs must be a finite number");
  }
  if (latencyMs < 0) {
    throw new ValidationError("latencyMs must not be negative");
  }
  return latencyMs;
}
