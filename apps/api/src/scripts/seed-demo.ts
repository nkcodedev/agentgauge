#!/usr/bin/env tsx
/**
 * Deterministic demo telemetry for local dashboard screenshots/tests.
 * Does not run on normal startup.
 */
import { createDb, agents, traces, modelPricing } from "@agentgauge/db";
import { createTestTenant } from "@agentgauge/db/test-helpers";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://agentgauge:agentgauge@localhost:5432/agentgauge";

async function main(): Promise<void> {
  const tenant = await createTestTenant("demo-dashboard");
  const db = createDb(connectionString);

  const pricing = await db.select().from(modelPricing).limit(1);
  if (pricing.length === 0) {
    console.log("Run pnpm db:seed first to load model pricing.");
  }

  const agentKeys = ["support-agent", "researcher", "triage-bot"];
  const agentIds: string[] = [];
  for (const key of agentKeys) {
    const inserted = await db
      .insert(agents)
      .values({
        projectId: tenant.projectId,
        agentKey: key,
        displayName: key,
      })
      .returning();
    agentIds.push(inserted[0]!.id);
  }

  const now = Date.now();
  for (let i = 0; i < 12; i++) {
    const started = new Date(now - i * 3_600_000);
    const ended = new Date(started.getTime() + 250 + i * 10);
    const eventId = crypto.randomUUID();
    const known = i % 4 !== 0;
    await db.insert(traces).values({
      eventId,
      traceId: eventId,
      projectId: tenant.projectId,
      agentId: agentIds[i % agentIds.length]!,
      environment: "development",
      provider: "openai",
      model: known ? "gpt-4o-mini" : "future-model-x",
      operationName: "demo",
      startedAt: started,
      endedAt: ended,
      latencyMs: ended.getTime() - started.getTime(),
      status: i % 5 === 0 ? "error" : "success",
      inputTokens: 1000 * (i + 1),
      outputTokens: 200 * (i + 1),
      totalTokens: 1200 * (i + 1),
      errorName: i % 5 === 0 ? "Error" : null,
      errorMessage: i % 5 === 0 ? "demo failure" : null,
      sdkName: "@agentgauge/node",
      sdkVersion: "0.4.0",
      inputCost: known ? String((1000 * (i + 1) * 0.15) / 1_000_000) : null,
      outputCost: known ? String((200 * (i + 1) * 0.6) / 1_000_000) : null,
      totalCost: known ? String((1000 * (i + 1) * 0.15 + 200 * (i + 1) * 0.6) / 1_000_000) : null,
      currency: known ? "USD" : null,
      costStatus: known ? "priced" : "unknown_model",
    });
  }

  console.log(
    JSON.stringify(
      {
        projectSlug: tenant.projectSlug,
        apiKey: tenant.apiKey,
        agents: agentKeys,
        note: "Store the API key for dashboard .env.local; it will not be shown again.",
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
