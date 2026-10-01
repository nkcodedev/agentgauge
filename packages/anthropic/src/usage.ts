/**
 * Normalize Anthropic Messages API usage into AgentGauge token fields.
 * Anthropic field names stay inside this package.
 */
export function extractMessagesUsage(usage: unknown): {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
} {
  if (usage === null || typeof usage !== "object") {
    return {};
  }

  const record = usage as Record<string, unknown>;
  const result: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  } = {};

  const input = asNonNegativeInt(record.input_tokens ?? record.inputTokens);
  const output = asNonNegativeInt(record.output_tokens ?? record.outputTokens);
  // Anthropic does not typically provide total_tokens; leave undefined so core can derive.
  const total = asNonNegativeInt(record.total_tokens ?? record.totalTokens);

  if (input !== undefined) result.inputTokens = input;
  if (output !== undefined) result.outputTokens = output;
  if (total !== undefined) result.totalTokens = total;

  return result;
}

/**
 * Map Anthropic prompt-cache usage into metadata.usageDetails (numeric only).
 */
export function extractUsageDetails(usage: unknown):
  | {
      cachedInputTokens?: number;
      cacheWriteTokens?: number;
    }
  | undefined {
  if (usage === null || typeof usage !== "object") {
    return undefined;
  }

  const record = usage as Record<string, unknown>;
  const cachedInputTokens = asNonNegativeInt(
    record.cache_read_input_tokens ?? record.cacheReadInputTokens,
  );
  const cacheWriteTokens = asNonNegativeInt(
    record.cache_creation_input_tokens ?? record.cacheCreationInputTokens,
  );

  if (cachedInputTokens === undefined && cacheWriteTokens === undefined) {
    return undefined;
  }

  const details: {
    cachedInputTokens?: number;
    cacheWriteTokens?: number;
  } = {};
  if (cachedInputTokens !== undefined) details.cachedInputTokens = cachedInputTokens;
  if (cacheWriteTokens !== undefined) details.cacheWriteTokens = cacheWriteTokens;
  return details;
}

/**
 * Model precedence: response.model when present, otherwise request.model.
 */
export function extractModel(response: unknown, request: unknown): string | undefined {
  const fromResponse = readStringField(response, "model");
  if (fromResponse !== undefined) {
    return fromResponse;
  }
  return readStringField(request, "model");
}

export function isStreamingRequest(request: unknown): boolean {
  if (request === null || typeof request !== "object") {
    return false;
  }
  return (request as Record<string, unknown>).stream === true;
}

function asNonNegativeInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return undefined;
  }
  if (value < 0) {
    return undefined;
  }
  return value;
}

function readStringField(value: unknown, key: string): string | undefined {
  if (value === null || typeof value !== "object") {
    return undefined;
  }
  const field = (value as Record<string, unknown>)[key];
  if (typeof field !== "string" || field.trim().length === 0) {
    return undefined;
  }
  return field.trim();
}
