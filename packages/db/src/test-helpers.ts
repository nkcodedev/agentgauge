import { createHash, randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, type Database } from "./client.js";
import { apiKeys, modelPricing, organizations, projects } from "./schema.js";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://agentgauge:agentgauge@localhost:5432/agentgauge";

function hashApiKey(plaintext: string): string {
  const pepper = process.env.AGENTGAUGE_API_KEY_PEPPER ?? "";
  return createHash("sha256").update(`${pepper}:${plaintext}`).digest("hex");
}

export interface TestTenant {
  readonly db: Database;
  readonly organizationId: string;
  readonly projectId: string;
  readonly projectSlug: string;
  readonly apiKey: string;
  readonly authHeader: string;
}

let migrated = false;

export async function ensureMigrated(): Promise<void> {
  if (migrated) return;
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);
  const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "drizzle");
  await migrate(db, { migrationsFolder });
  await client.end();
  migrated = true;
}

export async function createTestTenant(slugPrefix = "test"): Promise<TestTenant> {
  await ensureMigrated();
  const db = createDb(connectionString);
  const suffix = randomBytes(4).toString("hex");
  const projectSlug = `${slugPrefix}-${suffix}`;

  const org = (
    await db
      .insert(organizations)
      .values({ name: `Org ${suffix}` })
      .returning()
  )[0]!;
  const project = (
    await db
      .insert(projects)
      .values({
        organizationId: org.id,
        name: `Project ${suffix}`,
        slug: projectSlug,
      })
      .returning()
  )[0]!;

  const secret = randomBytes(32).toString("base64url");
  const apiKey = `ag_test_${secret}`;
  await db.insert(apiKeys).values({
    organizationId: org.id,
    projectId: project.id,
    name: "test-key",
    keyPrefix: apiKey.slice(0, 16),
    keyHash: hashApiKey(apiKey),
    environment: "test",
  });

  const pricing = await db.select().from(modelPricing).limit(1);
  if (pricing.length === 0) {
    await db.insert(modelPricing).values([
      {
        provider: "openai",
        model: "gpt-4o-mini",
        inputPricePerMillion: "0.15000000",
        outputPricePerMillion: "0.60000000",
        currency: "USD",
        effectiveFrom: new Date("2024-01-01T00:00:00.000Z"),
        effectiveTo: null,
        source: "test-seed",
      },
      {
        provider: "openai",
        model: "gpt-4o",
        inputPricePerMillion: "2.50000000",
        outputPricePerMillion: "10.00000000",
        currency: "USD",
        effectiveFrom: new Date("2024-01-01T00:00:00.000Z"),
        effectiveTo: null,
        source: "test-seed",
      },
      {
        provider: "openai",
        model: "gpt-4o-mini",
        inputPricePerMillion: "0.10000000",
        outputPricePerMillion: "0.40000000",
        currency: "USD",
        effectiveFrom: new Date("2023-01-01T00:00:00.000Z"),
        effectiveTo: new Date("2024-01-01T00:00:00.000Z"),
        source: "test-seed-historical",
      },
    ]);
  }

  return {
    db,
    organizationId: org.id,
    projectId: project.id,
    projectSlug,
    apiKey,
    authHeader: `Bearer ${apiKey}`,
  };
}

export function makeTraceEvent(overrides: Record<string, unknown> = {}) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  return {
    eventId: id,
    traceId: id,
    agentId: "support-agent",
    provider: "openai",
    model: "gpt-4o-mini",
    operationName: "answer",
    startedAt: now,
    endedAt: now,
    latencyMs: 42,
    status: "success" as const,
    usage: {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
    },
    sdk: { name: "@agentgauge/node", version: "0.4.0" },
    ...overrides,
  };
}
