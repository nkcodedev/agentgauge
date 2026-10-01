import { ConfigurationError } from "@agentgauge/node";
import type { ObserveGeminiOptions } from "./types.js";
import { createGenerateContentWrapper } from "./wrap-generate-content.js";

/**
 * Instrument a specific GoogleGenAI client instance with AgentGauge telemetry.
 *
 * Supported in v0.6.0 (non-streaming only):
 * - `client.models.generateContent(...)`
 *
 * Streaming (`models.generateContentStream`) is returned unmodified without telemetry.
 * Other methods/properties pass through.
 *
 * Canonical provider id is `"google"` (Gemini is the model family).
 *
 * Instrumentation is isolated to the returned wrapper — other Google clients
 * are unaffected. Telemetry failures never alter Google responses or errors.
 *
 * @param client - A `@google/genai` GoogleGenAI client instance
 * @param options - AgentGauge client + agent identity / context
 */
export function observeGemini<T extends object>(client: T, options: ObserveGeminiOptions): T {
  if (options === null || typeof options !== "object") {
    throw new ConfigurationError("observeGemini options are required");
  }
  if (options.gauge === undefined || options.gauge === null) {
    throw new ConfigurationError("observeGemini requires a gauge instance");
  }
  if (typeof options.agentId !== "string" || options.agentId.trim().length === 0) {
    throw new ConfigurationError("observeGemini requires a non-empty agentId");
  }

  const normalized: ObserveGeminiOptions = {
    ...options,
    agentId: options.agentId.trim(),
  };

  return wrapClient(client, normalized);
}

function wrapClient<T extends object>(client: T, options: ObserveGeminiOptions): T {
  const modelsCache = new WeakMap<object, object>();

  return new Proxy(client, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);

      if (property === "models" && value !== null && typeof value === "object") {
        const existing = modelsCache.get(value as object);
        if (existing) {
          return existing;
        }
        const wrapped = wrapModelsNamespace(value as object, options);
        modelsCache.set(value as object, wrapped);
        return wrapped;
      }

      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as T;
}

/**
 * Instrument only `generateContent`. Leave `generateContentStream` and other
 * models.* methods untouched (passthrough).
 */
function wrapModelsNamespace(namespace: object, options: ObserveGeminiOptions): object {
  return new Proxy(namespace, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (property === "generateContent" && typeof value === "function") {
        return createGenerateContentWrapper(
          value.bind(target) as (...args: never[]) => Promise<unknown>,
          options,
        );
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
