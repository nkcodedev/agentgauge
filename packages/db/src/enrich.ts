import { eq, inArray, desc, sql } from "drizzle-orm";
import type { Database } from "./client.js";
import { modelPricing, traces } from "./schema.js";
import { calculateCost, type PricingRow } from "./pricing.js";

async function loadPricing(db: Database): Promise<PricingRow[]> {
  const rows = await db.select().from(modelPricing);
  return rows.map((r) => ({
    provider: r.provider,
    model: r.model,
    inputPricePerMillion: String(r.inputPricePerMillion),
    outputPricePerMillion: String(r.outputPricePerMillion),
    currency: r.currency,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
    source: r.source,
  }));
}

/**
 * Enrich traces that still need cost resolution.
 *
 * - `pending`: always recompute (ingest race / deferred)
 * - `unknown_model`: recompute only when pricing can now produce `priced`
 *   (so newly seeded Anthropic/Google rows can backfill older traces)
 *
 * Never rewrites already-`priced` rows.
 */
export async function enrichPendingTraces(db: Database, limit = 100): Promise<number> {
  // Prefer `pending` so deferred ingest rows are not starved by a large
  // backlog of still-unpriced `unknown_model` rows. Newest first within a tier.
  const candidates = await db
    .select()
    .from(traces)
    .where(inArray(traces.costStatus, ["pending", "unknown_model"]))
    .orderBy(
      sql`case when ${traces.costStatus} = 'pending' then 0 else 1 end`,
      desc(traces.createdAt),
    )
    .limit(limit);

  if (candidates.length === 0) return 0;

  const pricingRows = await loadPricing(db);
  let updated = 0;

  for (const row of candidates) {
    const cost = calculateCost(
      {
        ...(row.provider ? { provider: row.provider } : {}),
        ...(row.model ? { model: row.model } : {}),
        ...(row.inputTokens !== null ? { inputTokens: row.inputTokens } : {}),
        ...(row.outputTokens !== null ? { outputTokens: row.outputTokens } : {}),
        timestamp: row.startedAt,
      },
      pricingRows,
    );

    if (row.costStatus === "unknown_model" && cost.status !== "priced") {
      continue;
    }

    const costStatus =
      cost.status === "priced"
        ? "priced"
        : cost.status === "no_usage"
          ? "no_usage"
          : "unknown_model";

    await db
      .update(traces)
      .set({
        inputCost: cost.inputCost,
        outputCost: cost.outputCost,
        totalCost: cost.totalCost,
        currency: cost.currency,
        costStatus,
      })
      .where(eq(traces.id, row.id));
    updated += 1;
  }

  return updated;
}

export async function countPendingTraces(db: Database): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(traces)
    .where(eq(traces.costStatus, "pending"));
  return result[0]?.count ?? 0;
}
