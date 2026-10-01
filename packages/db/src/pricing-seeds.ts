/**
 * Production model_pricing seed rows.
 *
 * Prices are USD per 1,000,000 tokens (standard paid API rates).
 * Verified against official provider docs — see internal/PRICING_SOURCES.md.
 *
 * Matching is exact (provider + model). No fuzzy suffixes.
 * Cache / batch / audio / long-context tiers are NOT modeled here.
 */

export interface ModelPricingSeed {
  readonly provider: string;
  readonly model: string;
  readonly inputPricePerMillion: string;
  readonly outputPricePerMillion: string;
  readonly currency: string;
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
  readonly source: string;
}

/** Canonical production seeds (OpenAI + Anthropic + Google). */
export const PRODUCTION_MODEL_PRICING: readonly ModelPricingSeed[] = [
  // --- OpenAI (audited CURRENT as of 2026-10-01) ---
  {
    provider: "openai",
    model: "gpt-4o-mini",
    inputPricePerMillion: "0.15000000",
    outputPricePerMillion: "0.60000000",
    currency: "USD",
    effectiveFrom: new Date("2024-01-01T00:00:00.000Z"),
    effectiveTo: null,
    source: "seed",
  },
  {
    provider: "openai",
    model: "gpt-4o",
    inputPricePerMillion: "2.50000000",
    outputPricePerMillion: "10.00000000",
    currency: "USD",
    effectiveFrom: new Date("2024-01-01T00:00:00.000Z"),
    effectiveTo: null,
    source: "seed",
  },
  // Historical OpenAI row for effective-date tests (LEGACY BUT VALID)
  {
    provider: "openai",
    model: "gpt-4o-mini",
    inputPricePerMillion: "0.10000000",
    outputPricePerMillion: "0.40000000",
    currency: "USD",
    effectiveFrom: new Date("2023-01-01T00:00:00.000Z"),
    effectiveTo: new Date("2024-01-01T00:00:00.000Z"),
    source: "seed-historical",
  },

  // --- Anthropic Claude API (verified 2026-10-01) ---
  // Current generation
  {
    provider: "anthropic",
    model: "claude-sonnet-5-5",
    inputPricePerMillion: "2.00000000",
    outputPricePerMillion: "10.00000000",
    currency: "USD",
    effectiveFrom: new Date("2026-06-30T00:00:00.000Z"),
    effectiveTo: null,
    source: "seed",
  },
  {
    provider: "anthropic",
    model: "claude-opus-5-5",
    inputPricePerMillion: "4.00000000",
    outputPricePerMillion: "20.00000000",
    currency: "USD",
    effectiveFrom: new Date("2026-06-30T00:00:00.000Z"),
    effectiveTo: null,
    source: "seed",
  },
  // Haiku 4.5: dated snapshot + Claude API alias
  {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    inputPricePerMillion: "1.00000000",
    outputPricePerMillion: "5.00000000",
    currency: "USD",
    effectiveFrom: new Date("2025-10-01T00:00:00.000Z"),
    effectiveTo: null,
    source: "seed",
  },
  {
    provider: "anthropic",
    model: "claude-haiku-4-5",
    inputPricePerMillion: "1.00000000",
    outputPricePerMillion: "5.00000000",
    currency: "USD",
    effectiveFrom: new Date("2025-10-01T00:00:00.000Z"),
    effectiveTo: null,
    source: "seed",
  },
  // Sonnet 4.5: dated snapshot + alias (still Active)
  {
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250929",
    inputPricePerMillion: "3.00000000",
    outputPricePerMillion: "15.00000000",
    currency: "USD",
    effectiveFrom: new Date("2025-09-29T00:00:00.000Z"),
    effectiveTo: null,
    source: "seed",
  },
  {
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    inputPricePerMillion: "3.00000000",
    outputPricePerMillion: "15.00000000",
    currency: "USD",
    effectiveFrom: new Date("2025-09-29T00:00:00.000Z"),
    effectiveTo: null,
    source: "seed",
  },
  // Opus 4.6 (dateless pinned ID; still Active)
  {
    provider: "anthropic",
    model: "claude-opus-4-6",
    inputPricePerMillion: "5.00000000",
    outputPricePerMillion: "25.00000000",
    currency: "USD",
    effectiveFrom: new Date("2026-02-04T00:00:00.000Z"),
    effectiveTo: null,
    source: "seed",
  },

  // --- Google Gemini Developer API (provider id = google; verified 2026-10-01) ---
  // Standard paid tier, text/image/video input. Audio / cache / batch not modeled.
  {
    provider: "google",
    model: "gemini-2.5-flash",
    inputPricePerMillion: "0.30000000",
    outputPricePerMillion: "2.50000000",
    currency: "USD",
    effectiveFrom: new Date("2025-06-17T00:00:00.000Z"),
    effectiveTo: null,
    source: "seed",
  },
  // Standard paid tier for prompts <= 200k tokens only (see PRICING_SOURCES).
  {
    provider: "google",
    model: "gemini-2.5-pro",
    inputPricePerMillion: "1.25000000",
    outputPricePerMillion: "10.00000000",
    currency: "USD",
    effectiveFrom: new Date("2025-06-17T00:00:00.000Z"),
    effectiveTo: null,
    source: "seed",
  },
];
