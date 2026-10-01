/**
 * Normalize @google/genai usageMetadata into AgentGauge token fields.
 * Google field names stay inside this package.
 *
 * Supports both historical `candidatesTokenCount` and newer `responseTokenCount`.
 */
export function extractGenerateContentUsage(usageMetadata: unknown): {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
} {
  if (usageMetadata === null || typeof usageMetadata !== "object") {
    return {};
  }

  const record = usageMetadata as Record<string, unknown>;
  const result: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  } = {};

  const input = asNonNegativeInt(record.promptTokenCount ?? record.prompt_token_count);
  const output = asNonNegativeInt(
    record.candidatesTokenCount ??
      record.candidates_token_count ??
      record.responseTokenCount ??
      record.response_token_count,
  );
  const total = asNonNegativeInt(record.totalTokenCount ?? record.total_token_count);

  if (input !== undefined) result.inputTokens = input;
  if (output !== undefined) result.outputTokens = output;
  if (total !== undefined) result.totalTokens = total;

  return result;
}

/**
 * Map Gemini cache/thinking counts into metadata.usageDetails (numeric only).
 */
export function extractUsageDetails(usageMetadata: unknown):
  | {
      cachedInputTokens?: number;
      reasoningTokens?: number;
    }
  | undefined {
  if (usageMetadata === null || typeof usageMetadata !== "object") {
    return undefined;
  }

  const record = usageMetadata as Record<string, unknown>;
  const cachedInputTokens = asNonNegativeInt(
    record.cachedContentTokenCount ?? record.cached_content_token_count,
  );
  const reasoningTokens = asNonNegativeInt(
    record.thoughtsTokenCount ?? record.thoughts_token_count,
  );

  if (cachedInputTokens === undefined && reasoningTokens === undefined) {
    return undefined;
  }

  const details: {
    cachedInputTokens?: number;
    reasoningTokens?: number;
  } = {};
  if (cachedInputTokens !== undefined) details.cachedInputTokens = cachedInputTokens;
  if (reasoningTokens !== undefined) details.reasoningTokens = reasoningTokens;
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
