/**
 * Shared AgentGauge error codes.
 */
export type AgentGaugeErrorCode = "agentgauge_error" | "configuration_error" | "validation_error";

/**
 * Base error for AgentGauge SDK misuse and validation failures.
 * Transport/delivery failures must not surface as thrown AgentGaugeError by default.
 */
export class AgentGaugeError extends Error {
  readonly code: AgentGaugeErrorCode;

  constructor(message: string, code: AgentGaugeErrorCode = "agentgauge_error") {
    super(message);
    this.name = "AgentGaugeError";
    this.code = code;
  }
}

/**
 * Thrown when SDK configuration is invalid or the client is used incorrectly
 * (for example, starting a trace after shutdown).
 */
export class ConfigurationError extends AgentGaugeError {
  constructor(message: string) {
    super(message, "configuration_error");
    this.name = "ConfigurationError";
  }
}

/**
 * Thrown when developer-supplied telemetry inputs fail validation.
 */
export class ValidationError extends AgentGaugeError {
  constructor(message: string) {
    super(message, "validation_error");
    this.name = "ValidationError";
  }
}
