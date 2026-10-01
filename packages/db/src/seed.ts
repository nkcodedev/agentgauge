import { eq } from "drizzle-orm";
import { createDb } from "./client.js";
import { modelPricing, organizations, projects, apiKeys } from "./schema.js";
import { createHash, randomBytes } from "node:crypto";

function hashApiKey(
  plaintext: string,
  pepper = process.env.AGENTGAUGE_API_KEY_PEPPER ?? "",
): string {
  return createHash("sha256").update(`${pepper}:${plaintext}`).digest("hex");
}

function generateApiKey(environment: "live" | "test" = "live") {
  const secret = randomBytes(32).toString("base64url");
  const plaintext = `ag_${environment}_${secret}`;
  return {
    plaintext,
    prefix: plaintext.slice(0, 16),
    hash: hashApiKey(plaintext),
    environment,
  };
}

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://agentgauge:agentgauge@localhost:5432/agentgauge";

async function main(): Promise<void> {
  const db = createDb(connectionString);

  const existingPricing = await db.select().from(modelPricing).limit(1);
  if (existingPricing.length === 0) {
    await db.insert(modelPricing).values([
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
      // Historical row for pricing-history tests
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
    ]);
    console.log("Seeded model_pricing rows.");
  } else {
    console.log("model_pricing already seeded; skipping.");
  }

  const orgName = "Local Development";
  const projectSlug = "demo-project";

  let org = (await db.select().from(organizations).limit(1))[0];
  if (!org) {
    const inserted = await db.insert(organizations).values({ name: orgName }).returning();
    org = inserted[0]!;
    console.log(`Created organization: ${orgName}`);
  }

  let project = (
    await db.select().from(projects).where(eq(projects.slug, projectSlug)).limit(1)
  )[0];
  if (!project) {
    const inserted = await db
      .insert(projects)
      .values({
        organizationId: org.id,
        name: "Demo Project",
        slug: projectSlug,
      })
      .returning();
    project = inserted[0]!;
    console.log(`Created project: ${projectSlug}`);
  }

  const key = generateApiKey("live");
  await db.insert(apiKeys).values({
    organizationId: org.id,
    projectId: project.id,
    name: "Local development key",
    keyPrefix: key.prefix,
    keyHash: key.hash,
    environment: key.environment,
  });

  console.log("");
  console.log("=== AgentGauge local seed ===");
  console.log(`Organization: ${org.name}`);
  console.log(`Project:      ${project.slug}`);
  console.log(`API key:      ${key.plaintext}`);
  console.log("");
  console.log("Store this API key now. It will not be shown again.");
  console.log("");

  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
