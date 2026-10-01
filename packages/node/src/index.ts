export { AgentGauge, type AgentGaugeConfig, type TransportConfig } from "./agent-gauge.js";
export { BatchedTransport, type BatchedTransportOptions } from "./batched-transport.js";
export { ConsoleTransport } from "./console-transport.js";
export { HttpTransport, type HttpTransportOptions } from "./http-transport.js";
export type { TraceHandle } from "./trace-handle.js";
export type { RunHandle } from "./run-handle.js";
export type {
  CreateRunPayload,
  EndRunPayload,
  Transport,
  TransportErrorHandler,
} from "./transport.js";
export { SDK_NAME, SDK_VERSION } from "./version.js";

export type {
  AgentGaugeMetadata,
  EndRunInput,
  EndTraceInput,
  FailTraceInput,
  RunStatus,
  StartRunInput,
  StartTraceInput,
  TerminalRunStatus,
  TokenUsage,
  TraceError,
  TraceEvent,
  TraceStatus,
} from "@agentgauge/core";

export { AgentGaugeError, ConfigurationError, ValidationError } from "@agentgauge/core";
