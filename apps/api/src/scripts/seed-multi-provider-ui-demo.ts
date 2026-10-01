#!/usr/bin/env tsx
/**
 * Local UI-review seed: multi-provider traces for demo-project.
 * Does not call paid provider APIs. Safe to re-run (clears this project's traces first).
 */
import { and, eq } from "drizzle-orm";
import {
  createDb,
  agents,
  apiKeys,
  projects,
  traces,
  calculateCost,
  ensureModelPricingSeeds,
  type PricingRow,
  modelPricing,
} from "@agentgauge/db";
import { createHash } from "node:crypto";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://agentgauge:agentgauge@localhost:5432/agentgauge";

const AGENT_KEYS = [
  "support-agent",
  "coding-agent",
  "research-agent",
  "invoice-agent",
  "content-agent",
] as const;

const KNOWN = [
  {
    provider: "openai",
    model: "gpt-4o-mini",
    operationName: "openai.chat.completions.create",
  },
  { provider: "openai", model: "gpt-4o", operationName: "openai.chat.completions.create" },
  {
    provider: "anthropic",
    model: "claude-sonnet-5-5",
    operationName: "anthropic.messages.create",
  },
  {
    provider: "anthropic",
    model: "claude-haiku-4-5",
    operationName: "anthropic.messages.create",
  },
  {
    provider: "anthropic",
    model: "claude-opus-4-6",
    operationName: "anthropic.messages.create",
  },
  {
    provider: "google",
    model: "gemini-2.5-flash",
    operationName: "google.models.generateContent",
  },
  {
    provider: "google",
    model: "gemini-2.5-pro",
    operationName: "google.models.generateContent",
  },
] as const;

const UNKNOWN = [
  {
    provider: "openai",
    model: "gpt-future-experimental",
    operationName: "openai.chat.completions.create",
  },
  {
    provider: "anthropic",
    model: "claude-sonnet-fake",
    operationName: "anthropic.messages.create",
  },
  {
    provider: "google",
    model: "gemini-2.5-flash-fake",
    operationName: "google.models.generateContent",
  },
] as const;

function hashApiKey(plaintext: string): string {
  const pepper = process.env.AGENTGAUGE_API_KEY_PEPPER ?? "";
  return createHash("sha256").update(`${pepper}:${plaintext}`).digest("hex");
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}

function intBetween(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

async function main(): Promise<void> {
  const apiKey = process.env.AGENTGAUGE_API_KEY;
  if (!apiKey) {
    throw new Error("AGENTGAUGE_API_KEY is required (from root .env)");
  }

  const db = createDb(connectionString);
  await ensureModelPricingSeeds(db);

  const keyHash = hashApiKey(apiKey);
  const keyRow = (await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1))[0];
  if (!keyRow) {
    throw new Error("AGENTGAUGE_API_KEY does not match any stored key");
  }

  const project = (
    await db.select().from(projects).where(eq(projects.id, keyRow.projectId)).limit(1)
  )[0];
  if (!project) {
    throw new Error("project missing for API key");
  }

  // Replace only this project's traces so Overview latency/charts are meaningful.
  await db.delete(traces).where(eq(traces.projectId, project.id));

  const agentIdByKey = new Map<string, string>();
  for (const key of AGENT_KEYS) {
    const existing = (
      await db
        .select()
        .from(agents)
        .where(and(eq(agents.projectId, project.id), eq(agents.agentKey, key)))
        .limit(1)
    )[0];
    if (existing) {
      agentIdByKey.set(key, existing.id);
      continue;
    }
    const inserted = (
      await db
        .insert(agents)
        .values({
          projectId: project.id,
          agentKey: key,
          displayName: key,
        })
        .returning()
    )[0]!;
    agentIdByKey.set(key, inserted.id);
  }

  const pricingRows: PricingRow[] = (await db.select().from(modelPricing)).map((r) => ({
    provider: r.provider,
    model: r.model,
    inputPricePerMillion: String(r.inputPricePerMillion),
    outputPricePerMillion: String(r.outputPricePerMillion),
    currency: r.currency,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
    source: r.source,
  }));

  const rand = mulberry32(0x06_00_04);
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const total = 100;

  let priced = 0;
  let unknown = 0;
  let errors = 0;

  for (let i = 0; i < total; i++) {
    const useUnknown = i % 12 === 0;
    const catalog: readonly {
      readonly provider: string;
      readonly model: string;
      readonly operationName: string;
    }[] = useUnknown ? UNKNOWN : KNOWN;
    const choice = pick(rand, catalog);
    const agentKey = pick(rand, AGENT_KEYS);
    const agentId = agentIdByKey.get(agentKey)!;

    // Spread across last 7 days with some clustering for chart shape.
    const dayBias = Math.pow(rand(), 0.7);
    const startedAt = new Date(
      now - Math.floor(dayBias * sevenDaysMs) - intBetween(rand, 0, 3_600_000),
    );
    const latencyMs = intBetween(rand, 220, 4_800);
    const endedAt = new Date(startedAt.getTime() + latencyMs);
    const isError = i % 9 === 0;
    if (isError) errors += 1;

    const inputTokens = intBetween(rand, 180, 12_500);
    const outputTokens = isError ? intBetween(rand, 0, 80) : intBetween(rand, 40, 2_800);
    const totalTokens = inputTokens + outputTokens;

    const cost = calculateCost(
      {
        provider: choice.provider,
        model: choice.model,
        inputTokens,
        outputTokens,
        timestamp: startedAt,
      },
      pricingRows,
    );

    const costStatus =
      cost.status === "priced"
        ? "priced"
        : cost.status === "no_usage"
          ? "no_usage"
          : "unknown_model";
    if (costStatus === "priced") priced += 1;
    if (costStatus === "unknown_model") unknown += 1;

    const eventId = crypto.randomUUID();
    await db.insert(traces).values({
      eventId,
      traceId: eventId,
      projectId: project.id,
      agentId,
      environment: "development",
      provider: choice.provider,
      model: choice.model,
      operationName: choice.operationName,
      startedAt,
      endedAt,
      latencyMs,
      status: isError ? "error" : "success",
      inputTokens,
      outputTokens,
      totalTokens,
      errorName: isError ? "ProviderError" : null,
      errorMessage: isError ? "Simulated upstream failure for UI review" : null,
      errorCode: isError ? "provider_error" : null,
      metadata:
        choice.provider === "anthropic"
          ? { usageDetails: { cachedInputTokens: intBetween(rand, 0, 200) } }
          : choice.provider === "google"
            ? { usageDetails: { reasoningTokens: intBetween(rand, 0, 120) } }
            : null,
      tags: ["ui-demo", choice.provider],
      sdkName: "@agentgauge/node",
      sdkVersion: "0.5.0",
      inputCost: cost.inputCost,
      outputCost: cost.outputCost,
      totalCost: cost.totalCost,
      currency: cost.currency,
      costStatus,
    });
  }

  // Bump agent lastSeen to newest trace times.
  for (const key of AGENT_KEYS) {
    const agentId = agentIdByKey.get(key)!;
    const latest = await db
      .select({ endedAt: traces.endedAt })
      .from(traces)
      .where(and(eq(traces.projectId, project.id), eq(traces.agentId, agentId)))
      .orderBy(traces.endedAt)
      .limit(1);
    // orderBy asc then take last via max — simpler update from SQL max
    void latest;
    await db.update(agents).set({ lastSeenAt: new Date() }).where(eq(agents.id, agentId));
  }

  console.log(
    JSON.stringify(
      {
        projectSlug: project.slug,
        projectId: project.id,
        keyPrefix: keyRow.keyPrefix,
        agents: AGENT_KEYS,
        totalTraces: total,
        priced,
        unknownPrice: unknown,
        errors,
        note: "Traces replaced for this project only. Secrets not printed.",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
