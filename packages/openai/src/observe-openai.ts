import { ConfigurationError } from "@agentgauge/node";
import type { ObserveOpenAIOptions } from "./types.js";
import { createChatCompletionsCreateWrapper, createResponsesCreateWrapper } from "./wrap-create.js";

/**
 * Instrument a specific OpenAI client instance with AgentGauge telemetry.
 *
 * Supported in v0.2.0 (non-streaming only):
 * - `client.responses.create(...)`
 * - `client.chat.completions.create(...)`
 *
 * Streaming (`stream: true`) is returned unmodified without telemetry.
 *
 * Instrumentation is isolated to the returned wrapper — other OpenAI clients
 * are unaffected. Telemetry failures never alter OpenAI responses or errors.
 *
 * @param client - An OpenAI SDK client instance (openai ^4 || ^5 || ^6)
 * @param options - AgentGauge client + agent identity / context
 */
export function observeOpenAI<T extends object>(client: T, options: ObserveOpenAIOptions): T {
  if (options === null || typeof options !== "object") {
    throw new ConfigurationError("observeOpenAI options are required");
  }
  if (options.gauge === undefined || options.gauge === null) {
    throw new ConfigurationError("observeOpenAI requires a gauge instance");
  }
  if (typeof options.agentId !== "string" || options.agentId.trim().length === 0) {
    throw new ConfigurationError("observeOpenAI requires a non-empty agentId");
  }

  const normalized: ObserveOpenAIOptions = {
    ...options,
    agentId: options.agentId.trim(),
  };

  return wrapClient(client, normalized);
}

function wrapClient<T extends object>(client: T, options: ObserveOpenAIOptions): T {
  const responsesCache = new WeakMap<object, object>();
  const chatCache = new WeakMap<object, object>();
  const completionsCache = new WeakMap<object, object>();

  return new Proxy(client, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);

      if (property === "responses" && value !== null && typeof value === "object") {
        const existing = responsesCache.get(value as object);
        if (existing) {
          return existing;
        }
        const wrapped = wrapNamespace(value as object, "create", (original) =>
          createResponsesCreateWrapper(original as (...args: never[]) => Promise<unknown>, options),
        );
        responsesCache.set(value as object, wrapped);
        return wrapped;
      }

      if (property === "chat" && value !== null && typeof value === "object") {
        const existing = chatCache.get(value as object);
        if (existing) {
          return existing;
        }
        const wrappedChat = new Proxy(value as object, {
          get(chatTarget, chatProperty, chatReceiver) {
            const chatValue = Reflect.get(chatTarget, chatProperty, chatReceiver);
            if (
              chatProperty === "completions" &&
              chatValue !== null &&
              typeof chatValue === "object"
            ) {
              const existingCompletions = completionsCache.get(chatValue as object);
              if (existingCompletions) {
                return existingCompletions;
              }
              const wrappedCompletions = wrapNamespace(chatValue as object, "create", (original) =>
                createChatCompletionsCreateWrapper(
                  original as (...args: never[]) => Promise<unknown>,
                  options,
                ),
              );
              completionsCache.set(chatValue as object, wrappedCompletions);
              return wrappedCompletions;
            }
            return typeof chatValue === "function" ? chatValue.bind(chatTarget) : chatValue;
          },
        });
        chatCache.set(value as object, wrappedChat);
        return wrappedChat;
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
