import type { AgentGauge, AgentGaugeMetadata } from "@agentgauge/node";

/**
 * Options for observeGemini().
 *
 * Precedence for project/environment:
 * 1. Values provided here (provider config)
 * 2. Defaults from the AgentGauge client
 *
 * `provider` and `operationName` are set automatically and cannot be overridden.
 * Canonical provider id is `"google"` (not `"gemini"`).
 */
export interface ObserveGeminiOptions {
  readonly gauge: AgentGauge;
  /** Required agent identity stamped onto every automatic trace. */
  readonly agentId: string;
  /** Optional project override (otherwise AgentGauge defaults apply). */
  readonly project?: string;
  /** Optional environment override (otherwise AgentGauge defaults apply). */
  readonly environment?: string;
  readonly tags?: readonly string[];
  readonly metadata?: AgentGaugeMetadata;
}

/** Canonical operation name for Google GenAI generateContent. */
export const OPERATION_GENERATE_CONTENT = "google.models.generateContent";
