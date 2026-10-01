import { ConfigurationError } from "@agentgauge/node";
import type { ObserveAnthropicOptions } from "./types.js";
import { createMessagesCreateWrapper } from "./wrap-messages-create.js";

/**
 * Instrument a specific Anthropic client instance with AgentGauge telemetry.
 *
 * Supported in v0.6.0 (non-streaming only):
 * - `client.messages.create(...)`
 *
 * Streaming (`stream: true`) is returned unmodified without telemetry.
 * Other methods/properties (including `messages.stream` if present) pass through.
 *
 * Instrumentation is isolated to the returned wrapper — other Anthropic clients
 * are unaffected. Telemetry failures never alter Anthropic responses or errors.
 *
 * @param client - An Anthropic SDK client instance (`@anthropic-ai/sdk`)
 * @param options - AgentGauge client + agent identity / context
 */
export function observeAnthropic<T extends object>(client: T, options: ObserveAnthropicOptions): T {
  if (options === null || typeof options !== "object") {
    throw new ConfigurationError("observeAnthropic options are required");
  }
  if (options.gauge === undefined || options.gauge === null) {
    throw new ConfigurationError("observeAnthropic requires a gauge instance");
  }
  if (typeof options.agentId !== "string" || options.agentId.trim().length === 0) {
    throw new ConfigurationError("observeAnthropic requires a non-empty agentId");
  }

  const normalized: ObserveAnthropicOptions = {
    ...options,
    agentId: options.agentId.trim(),
  };

  return wrapClient(client, normalized);
}

function wrapClient<T extends object>(client: T, options: ObserveAnthropicOptions): T {
  const messagesCache = new WeakMap<object, object>();

  return new Proxy(client, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);

      if (property === "messages" && value !== null && typeof value === "object") {
        const existing = messagesCache.get(value as object);
        if (existing) {
          return existing;
        }
        const wrapped = wrapNamespace(value as object, "create", (original) =>
          createMessagesCreateWrapper(original as (...args: never[]) => Promise<unknown>, options),
        );
        messagesCache.set(value as object, wrapped);
        return wrapped;
      }

      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as T;
}

function wrapNamespace(
  namespace: object,
  methodName: string,
  wrapMethod: (original: (...args: never[]) => Promise<unknown>) => unknown,
): object {
  return new Proxy(namespace, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (property === methodName && typeof value === "function") {
        return wrapMethod(value.bind(target) as (...args: never[]) => Promise<unknown>);
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
