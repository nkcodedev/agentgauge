import { eq } from "drizzle-orm";
import { createDb } from "./client.js";
import { organizations, projects, apiKeys } from "./schema.js";
import { ensureModelPricingSeeds } from "./ensure-pricing-seeds.js";
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

  const pricing = await ensureModelPricingSeeds(db);
  console.log(
    `model_pricing seeds: inserted=${pricing.inserted}, skipped=${pricing.skipped} (idempotent).`,
  );

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
