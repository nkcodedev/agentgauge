import { ValidationError } from "./errors.js";
import type {
  AgentGaugeMetadata,
  EndTraceInput,
  FailTraceInput,
  StartTraceInput,
  TokenUsage,
  TraceError,
} from "./types.js";

const FORBIDDEN_CONTENT_KEYS = new Set([
  "prompt",
  "completion",
  "messages",
  "responseBody",
  "response_body",
]);

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
 * Validates and shallow-freezes user metadata.
 * Rejects known content-capture keys that are unsupported in V1.
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

  return Object.freeze({ ...metadata });
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
  const traceId = assertOptionalNonEmptyString(input.traceId, "traceId");
  const metadata = normalizeMetadata(input.metadata);
  const tags = normalizeTags(input.tags);

  const result: {
    agentId: string;
    project?: string;
    environment?: string;
    provider?: string;
    model?: string;
    operationName?: string;
    metadata?: AgentGaugeMetadata;
    tags?: readonly string[];
    traceId?: string;
  } = { agentId };

  if (project !== undefined) result.project = project;
  if (environment !== undefined) result.environment = environment;
  if (provider !== undefined) result.provider = provider;
  if (model !== undefined) result.model = model;
  if (operationName !== undefined) result.operationName = operationName;
  if (traceId !== undefined) result.traceId = traceId;
  if (metadata !== undefined) result.metadata = metadata;
  if (tags !== undefined) result.tags = tags;

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
