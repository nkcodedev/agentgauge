import { eq, sql } from "drizzle-orm";
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
  }));
}

/** Enrich traces still marked cost_status=pending (worker / backfill). */
export async function enrichPendingTraces(db: Database, limit = 100): Promise<number> {
  const pending = await db
    .select()
    .from(traces)
    .where(eq(traces.costStatus, "pending"))
    .limit(limit);

  if (pending.length === 0) return 0;

  const pricingRows = await loadPricing(db);
  let updated = 0;

  for (const row of pending) {
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
