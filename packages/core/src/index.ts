export type {
  AgentGaugeMetadata,
  BuildTraceEventInput,
  EndRunInput,
  EndTraceInput,
  FailTraceInput,
  RunStatus,
  SdkInfo,
  StartRunInput,
  StartTraceInput,
  TerminalRunStatus,
  TokenUsage,
  TraceError,
  TraceEvent,
  TraceStatus,
} from "./types.js";

export { TERMINAL_RUN_STATUSES } from "./types.js";

export type { CanonicalProvider, UsageDetails, UsageDetailsKey } from "./providers.js";
export { CANONICAL_PROVIDERS, USAGE_DETAILS_KEYS } from "./providers.js";

export {
  AgentGaugeError,
  ConfigurationError,
  ValidationError,
  type AgentGaugeErrorCode,
} from "./errors.js";

export { buildTraceEvent } from "./build-trace-event.js";

export {
  assertNonNegativeLatency,
  FORBIDDEN_METADATA_CONTENT_KEYS,
  normalizeMetadata,
  normalizeTags,
  normalizeTokenUsage,
  normalizeTraceError,
  normalizeUsage,
  validateEndRunInput,
  validateEndTraceInput,
  validateFailTraceInput,
  validateStartRunInput,
  validateStartTraceInput,
} from "./validation.js";
