export type {
  AgentGaugeMetadata,
  BuildTraceEventInput,
  EndTraceInput,
  FailTraceInput,
  SdkInfo,
  StartTraceInput,
  TokenUsage,
  TraceError,
  TraceEvent,
  TraceStatus,
} from "./types.js";

export {
  AgentGaugeError,
  ConfigurationError,
  ValidationError,
  type AgentGaugeErrorCode,
} from "./errors.js";

export { buildTraceEvent } from "./build-trace-event.js";

export {
  assertNonNegativeLatency,
  normalizeMetadata,
  normalizeTags,
  normalizeTokenUsage,
  normalizeTraceError,
  validateEndTraceInput,
  validateFailTraceInput,
  validateStartTraceInput,
} from "./validation.js";
