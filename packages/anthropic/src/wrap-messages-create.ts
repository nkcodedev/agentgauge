import type { AgentGauge, TraceHandle } from "@agentgauge/node";
import type { ObserveAnthropicOptions } from "./types.js";
import { OPERATION_MESSAGES_CREATE } from "./types.js";
import {
  extractMessagesUsage,
  extractModel,
  extractUsageDetails,
  isStreamingRequest,
} from "./usage.js";

interface InstrumentCreateOptions {
  readonly gauge: AgentGauge;
  readonly agentId: string;
  readonly project?: string;
  readonly environment?: string;
  readonly tags?: readonly string[];
  readonly metadata?: ObserveAnthropicOptions["metadata"];
}

/**
 * Wraps Anthropic messages.create() with AgentGauge tracing.
 * Streaming requests (`stream: true`) are returned unmodified without instrumentation.
 */
export function wrapMessagesCreate<TArgs extends unknown[], TResult>(
  original: (...args: TArgs) => Promise<TResult>,
  options: InstrumentCreateOptions,
): (...args: TArgs) => Promise<TResult> {
  return async function instrumentedCreate(this: unknown, ...args: TArgs): Promise<TResult> {
    const request = args[0];

    if (isStreamingRequest(request)) {
      return original.apply(this, args);
    }

    let trace: TraceHandle | undefined;
    try {
      const requestModel = extractModel(undefined, request);
      trace = options.gauge.startTrace({
        agentId: options.agentId,
        provider: "anthropic",
        operationName: OPERATION_MESSAGES_CREATE,
        ...definedFields({
          project: options.project,
          environment: options.environment,
          tags: options.tags,
          metadata: options.metadata,
          model: requestModel,
        }),
      });
    } catch {
      // Instrumentation setup must never block the Anthropic call.
      return original.apply(this, args);
    }

    try {
      const result = await original.apply(this, args);
      safelyEnd(trace, result, request);
      return result;
    } catch (error) {
      safelyFail(trace, error);
      throw error;
    }
  };
}

function safelyEnd(trace: TraceHandle, result: unknown, request: unknown): void {
  try {
    const usageSource =
      result !== null && typeof result === "object"
        ? (result as Record<string, unknown>).usage
        : undefined;
    const usage = extractMessagesUsage(usageSource);
    const usageDetails = extractUsageDetails(usageSource);
    const model = extractModel(result, request);

    const endInput: Parameters<TraceHandle["end"]>[0] = {
      ...usage,
      ...(model !== undefined ? { model } : {}),
      ...(usageDetails !== undefined ? { metadata: { usageDetails } } : {}),
    };
    trace.end(endInput);
  } catch {
    // Telemetry completion failures must not alter the Anthropic result.
  }
}

function safelyFail(trace: TraceHandle, error: unknown): void {
  try {
    trace.fail(error);
  } catch {
    // Telemetry failure path must not replace the Anthropic error.
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

export function createMessagesCreateWrapper(
  original: (...args: never[]) => Promise<unknown>,
  options: ObserveAnthropicOptions,
): (...args: never[]) => Promise<unknown> {
  return wrapMessagesCreate(original, {
    gauge: options.gauge,
    agentId: options.agentId,
    ...(options.project !== undefined ? { project: options.project } : {}),
    ...(options.environment !== undefined ? { environment: options.environment } : {}),
    ...(options.tags !== undefined ? { tags: options.tags } : {}),
    ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
  });
}
