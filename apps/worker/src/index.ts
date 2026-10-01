import { createDb, enrichPendingTraces } from "@agentgauge/db";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://agentgauge:agentgauge@localhost:5432/agentgauge";
const pollMs = Number(process.env.WORKER_POLL_MS ?? 2000);
const batchSize = Number(process.env.WORKER_BATCH_SIZE ?? 100);

async function main(): Promise<void> {
  const db = createDb(connectionString);
  console.log(`AgentGauge worker started (poll=${pollMs}ms, batch=${batchSize})`);

  for (;;) {
    try {
      const updated = await enrichPendingTraces(db, batchSize);
      if (updated > 0) {
        console.log(`Enriched ${updated} pending trace(s)`);
      }
    } catch (error) {
      console.error("Worker poll failed:", error);
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
