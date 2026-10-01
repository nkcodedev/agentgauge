import type { AgentGauge, AgentGaugeMetadata } from "@agentgauge/node";

/**
 * Options for observeOpenAI().
 *
 * Precedence for project/environment:
 * 1. Values provided here (provider config)
 * 2. Defaults from the AgentGauge client
 *
 * `provider` and `operationName` are set automatically and cannot be overridden.
 */
export interface ObserveOpenAIOptions {
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

export const OPERATION_RESPONSES_CREATE = "openai.responses.create";
export const OPERATION_CHAT_COMPLETIONS_CREATE = "openai.chat.completions.create";
