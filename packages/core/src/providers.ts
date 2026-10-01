/**
 * Canonical AgentGauge provider identifiers (extensible free-form strings).
 *
 * `provider` on TraceEvent remains `string | undefined` — this list is documentation
 * and convenience only, not a closed enum.
 *
 * Gemini models use provider `"google"` (not `"gemini"`).
 */
export const CANONICAL_PROVIDERS = Object.freeze({
  openai: "openai",
  anthropic: "anthropic",
  google: "google",
} as const);

export type CanonicalProvider = (typeof CANONICAL_PROVIDERS)[keyof typeof CANONICAL_PROVIDERS];

/**
 * Suggested future provider ids (not implemented):
 * azure-openai, aws-bedrock, mistral, cohere, groq, ollama
 */

/**
 * Operation naming convention for automatic instrumentation:
 * `provider.resource.method`
 *
 * Examples:
 * - openai.responses.create
 * - openai.chat.completions.create
 * - anthropic.messages.create
 * - google.models.generateContent
 *
 * Existing OpenAI operation names already match this convention; preserve them.
 */

/**
 * Optional supplemental token breakdowns nested under metadata.usageDetails.
 * Not first-class TraceEvent.usage fields and not used by the v0.6.0 cost engine.
 */
export const USAGE_DETAILS_KEYS = Object.freeze([
  "cachedInputTokens",
  "cacheWriteTokens",
  "reasoningTokens",
] as const);

export type UsageDetailsKey = (typeof USAGE_DETAILS_KEYS)[number];

export interface UsageDetails {
  readonly cachedInputTokens?: number;
  readonly cacheWriteTokens?: number;
  readonly reasoningTokens?: number;
}
