import { and, eq } from "drizzle-orm";
import type { Database } from "./client.js";
import { modelPricing } from "./schema.js";
import { PRODUCTION_MODEL_PRICING, type ModelPricingSeed } from "./pricing-seeds.js";

export type { ModelPricingSeed } from "./pricing-seeds.js";
export { PRODUCTION_MODEL_PRICING } from "./pricing-seeds.js";

/**
 * Idempotently insert production pricing rows.
 * Never overwrites an existing (provider, model, effectiveFrom) row.
 */
export async function ensureModelPricingSeeds(
  db: Database,
  seeds: readonly ModelPricingSeed[] = PRODUCTION_MODEL_PRICING,
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const seed of seeds) {
    const existing = await db
      .select({ id: modelPricing.id })
      .from(modelPricing)
      .where(
        and(
          eq(modelPricing.provider, seed.provider),
          eq(modelPricing.model, seed.model),
          eq(modelPricing.effectiveFrom, seed.effectiveFrom),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      skipped += 1;
      continue;
    }

    await db.insert(modelPricing).values({
      provider: seed.provider,
      model: seed.model,
      inputPricePerMillion: seed.inputPricePerMillion,
      outputPricePerMillion: seed.outputPricePerMillion,
      currency: seed.currency,
      effectiveFrom: seed.effectiveFrom,
      effectiveTo: seed.effectiveTo,
      source: seed.source,
    });
    inserted += 1;
  }

  return { inserted, skipped };
}

/** Providers currently covered by production seeds. */
export function seededProviders(): string[] {
  return [...new Set(PRODUCTION_MODEL_PRICING.map((r) => r.provider))];
}
