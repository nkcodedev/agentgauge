import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { enrichPendingTraces } from "./enrich.js";
import {
  createModelPricing,
  listModelPricing,
  ModelPricingError,
  resetModelPricingOverride,
  supersedeModelPricing,
} from "./model-pricing-catalog.js";
import { selectPricing } from "./pricing.js";
import { agents, modelPricing, traces } from "./schema.js";
import { createTestTenant, ensureMigrated } from "./test-helpers.js";

describe("model pricing catalog", () => {
  beforeAll(async () => {
    await ensureMigrated();
  });

  it("creates custom pricing, supersedes it, and keeps the old row", async () => {
    const tenant = await createTestTenant("pricing");
    const model = `widget-${randomUUID().slice(0, 8)}`;
    const created = await createModelPricing(tenant.db, {
      provider: "acme",
      model,
      inputPricePerMillion: "1.5",
      outputPricePerMillion: "3",
      effectiveFrom: "2090-01-01T00:00:00.000Z",
    });
    expect(created.kind).toBe("custom");
    expect(created.status).toBe("upcoming");

    const next = await supersedeModelPricing(tenant.db, created.id, {
      inputPricePerMillion: "2",
      outputPricePerMillion: "4",
      effectiveFrom: "2090-06-01T00:00:00.000Z",
    });
    expect(next.closed.effectiveTo).toBe("2090-06-01T00:00:00.000Z");
    expect(Number(next.created.inputPricePerMillion)).toBeCloseTo(2, 6);
    expect(next.closed.id).toBe(created.id);

    const history = await listModelPricing(tenant.db, { provider: "acme", model });
    expect(history).toHaveLength(2);
    const rows = await tenant.db.select().from(modelPricing).where(eq(modelPricing.id, created.id));
    expect(Number(rows[0]!.inputPricePerMillion)).toBeCloseTo(1.5, 6);
  });

  it("rejects overlap, negative prices, and inverted dates", async () => {
    const tenant = await createTestTenant("pricing-bad");
    const model = `overlap-${randomUUID().slice(0, 8)}`;
    await createModelPricing(tenant.db, {
      provider: "acme",
      model,
      inputPricePerMillion: "1",
      outputPricePerMillion: "1",
      effectiveFrom: "2091-01-01T00:00:00.000Z",
    });
    await expect(
      createModelPricing(tenant.db, {
        provider: "acme",
        model,
        inputPricePerMillion: "2",
        outputPricePerMillion: "2",
        effectiveFrom: "2091-06-01T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    await expect(
      createModelPricing(tenant.db, {
        provider: "acme",
        model: `neg-${randomUUID().slice(0, 8)}`,
        inputPricePerMillion: "-1",
        outputPricePerMillion: "1",
        effectiveFrom: "2091-01-01T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(ModelPricingError);

    await expect(
      createModelPricing(tenant.db, {
        provider: "acme",
        model: `dates-${randomUUID().slice(0, 8)}`,
        inputPricePerMillion: "1",
        outputPricePerMillion: "1",
        effectiveFrom: "2091-06-01T00:00:00.000Z",
        effectiveTo: "2091-01-01T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ message: "Invalid effective date range." });
  });

  it("prices an unknown model after a rate is added and leaves priced traces unchanged", async () => {
    const tenant = await createTestTenant("pricing-trace");
    const agent = (
      await tenant.db
        .insert(agents)
        .values({ projectId: tenant.projectId, agentKey: "pricing-agent" })
        .returning()
    )[0]!;
    const model = `fresh-${randomUUID().slice(0, 8)}`;
    const unknownId = randomUUID();
    const pricedId = randomUUID();
    const started = new Date("2026-08-01T00:00:00.000Z");

    await tenant.db.insert(traces).values([
      {
        eventId: unknownId,
        traceId: unknownId,
        projectId: tenant.projectId,
        agentId: agent.id,
        provider: "acme",
        model,
        startedAt: started,
        endedAt: started,
        latencyMs: 10,
        status: "success",
        inputTokens: 1_000_000,
        outputTokens: 0,
        totalTokens: 1_000_000,
        sdkName: "@agentgauge/node",
        sdkVersion: "0.5.0",
        costStatus: "unknown_model",
        totalCost: null,
      },
      {
        eventId: pricedId,
        traceId: pricedId,
        projectId: tenant.projectId,
        agentId: agent.id,
        provider: "acme",
        model,
        startedAt: started,
        endedAt: started,
        latencyMs: 10,
        status: "success",
        inputTokens: 1_000_000,
        outputTokens: 0,
        totalTokens: 1_000_000,
        sdkName: "@agentgauge/node",
        sdkVersion: "0.5.0",
        costStatus: "priced",
        totalCost: "9.0000000000",
        currency: "USD",
      },
    ]);

    const created = await createModelPricing(tenant.db, {
      provider: "acme",
      model,
      inputPricePerMillion: "1.25",
      outputPricePerMillion: "0",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
    });
    await enrichPendingTraces(tenant.db, 200);

    const unknown = (
      await tenant.db.select().from(traces).where(eq(traces.eventId, unknownId))
    )[0]!;
    expect(unknown.costStatus).toBe("priced");
    expect(Number(unknown.totalCost)).toBeCloseTo(1.25, 6);

    await supersedeModelPricing(tenant.db, created.id, {
      inputPricePerMillion: "9",
      outputPricePerMillion: "9",
      effectiveFrom: "2026-09-01T00:00:00.000Z",
    });
    await enrichPendingTraces(tenant.db, 200);
    const priced = (await tenant.db.select().from(traces).where(eq(traces.eventId, pricedId)))[0]!;
    expect(priced.totalCost).toBe("9.0000000000");
    expect(priced.costStatus).toBe("priced");
  });

  it("lets an override outrank a seed, then reset restores the seed", async () => {
    const tenant = await createTestTenant("pricing-override");
    const created = await createModelPricing(tenant.db, {
      provider: "openai",
      model: "gpt-4o-mini",
      inputPricePerMillion: "5",
      outputPricePerMillion: "6",
      effectiveFrom: "2092-01-01T00:00:00.000Z",
    });
    expect(created.kind).toBe("override");

    const rows = await tenant.db.select().from(modelPricing);
    const atOverride = selectPricing(
      rows.map((row) => ({
        provider: row.provider,
        model: row.model,
        inputPricePerMillion: String(row.inputPricePerMillion),
        outputPricePerMillion: String(row.outputPricePerMillion),
        currency: row.currency,
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo,
        source: row.source,
      })),
      "openai",
      "gpt-4o-mini",
      new Date("2092-02-01T00:00:00.000Z"),
    );
    expect(atOverride?.source).toBe("override");

    const ended = await resetModelPricingOverride(
      tenant.db,
      created.id,
      new Date("2026-10-01T00:00:00.000Z"),
    );
    expect(ended.status).toBe("historical");
    const after = await tenant.db.select().from(modelPricing);
    const seed = selectPricing(
      after.map((row) => ({
        provider: row.provider,
        model: row.model,
        inputPricePerMillion: String(row.inputPricePerMillion),
        outputPricePerMillion: String(row.outputPricePerMillion),
        currency: row.currency,
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo,
        source: row.source,
      })),
      "openai",
      "gpt-4o-mini",
      new Date("2092-02-01T00:00:00.000Z"),
    );
    expect(seed?.source).not.toBe("override");
    expect(Number(seed?.inputPricePerMillion)).not.toBeCloseTo(5, 6);
  });
});
