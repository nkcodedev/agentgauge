import type { AgentGauge, TraceHandle } from "@agentgauge/node";
import type { ObserveOpenAIOptions } from "./types.js";
import {
  extractChatCompletionsUsage,
  extractModel,
  extractResponsesUsage,
  isStreamingRequest,
} from "./usage.js";
import { OPERATION_CHAT_COMPLETIONS_CREATE, OPERATION_RESPONSES_CREATE } from "./types.js";

type UsageExtractor = (usage: unknown) => {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

interface InstrumentCreateOptions {
  readonly gauge: AgentGauge;
  readonly agentId: string;
  readonly project?: string;
  readonly environment?: string;
  readonly tags?: readonly string[];
  readonly metadata?: ObserveOpenAIOptions["metadata"];
  readonly operationName: string;
  readonly extractUsage: UsageExtractor;
}

/**
 * Wraps an async create() method with AgentGauge tracing.
 * Streaming requests are returned unmodified without instrumentation (v0.2.0).
 */
export function wrapCreateMethod<TArgs extends unknown[], TResult>(
  original: (...args: TArgs) => Promise<TResult>,
  options: InstrumentCreateOptions,
): (...args: TArgs) => Promise<TResult> {
  return async function instrumentedCreate(this: unknown, ...args: TArgs): Promise<TResult> {
    const request = args[0];

    // Preserve OpenAI streaming behavior without claiming full telemetry support.
    if (isStreamingRequest(request)) {
      return original.apply(this, args);
    }

    let trace: TraceHandle | undefined;
    try {
      const requestModel = extractModel(undefined, request);
      trace = options.gauge.startTrace({
        agentId: options.agentId,
        provider: "openai",
        operationName: options.operationName,
        ...definedFields({
          project: options.project,
          environment: options.environment,
          tags: options.tags,
          metadata: options.metadata,
          model: requestModel,
        }),
      });
    } catch {
      // Instrumentation setup must never block the OpenAI call.
      return original.apply(this, args);
    }

    try {
      const result = await original.apply(this, args);
      safelyEnd(trace, result, request, options.extractUsage);
      return result;
    } catch (error) {
      safelyFail(trace, error);
      throw error;
    }
  };
}

function safelyEnd(
  trace: TraceHandle,
  result: unknown,
  request: unknown,
  extractUsage: UsageExtractor,
): void {
  try {
    const usageSource =
      result !== null && typeof result === "object"
        ? (result as Record<string, unknown>).usage
        : undefined;
    const usage = extractUsage(usageSource);
    const model = extractModel(result, request);

    const endInput: Parameters<TraceHandle["end"]>[0] = {
      ...usage,
      ...(model !== undefined ? { model } : {}),
    };
    trace.end(endInput);
  } catch {
    // Telemetry completion failures must not alter the OpenAI result.
  }
}

function safelyFail(trace: TraceHandle, error: unknown): void {
  try {
    trace.fail(error);
  } catch {
    // Telemetry failure path must not replace the OpenAI error.
  }
}

function definedFields<T extends Record<string, unknown>>(
  fields: T,
): {
  [K in keyof T]?: Exclude<T[K], undefined>;
} {
  const result: {
    [K in keyof T]?: Exclude<T[K], undefined>;
  } = {};
  for (const key of Object.keys(fields) as Array<keyof T>) {
    const value = fields[key];
    if (value !== undefined) {
      result[key] = value as Exclude<T[keyof T], undefined>;
    }
  }
  return result;
}

export function createResponsesCreateWrapper(
  original: (...args: never[]) => Promise<unknown>,
  options: ObserveOpenAIOptions,
): (...args: never[]) => Promise<unknown> {
  return wrapCreateMethod(original, {
    gauge: options.gauge,
    agentId: options.agentId,
    ...(options.project !== undefined ? { project: options.project } : {}),
    ...(options.environment !== undefined ? { environment: options.environment } : {}),
    ...(options.tags !== undefined ? { tags: options.tags } : {}),
    ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
    operationName: OPERATION_RESPONSES_CREATE,
    extractUsage: extractResponsesUsage,
  });
}

export function createChatCompletionsCreateWrapper(
  original: (...args: never[]) => Promise<unknown>,
  options: ObserveOpenAIOptions,
): (...args: never[]) => Promise<unknown> {
  return wrapCreateMethod(original, {
    gauge: options.gauge,
    agentId: options.agentId,
    ...(options.project !== undefined ? { project: options.project } : {}),
    ...(options.environment !== undefined ? { environment: options.environment } : {}),
    ...(options.tags !== undefined ? { tags: options.tags } : {}),
    ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
    operationName: OPERATION_CHAT_COMPLETIONS_CREATE,
    extractUsage: extractChatCompletionsUsage,
  });
}
