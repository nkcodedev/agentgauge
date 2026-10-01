#!/usr/bin/env tsx
/**
 * Create an organization/project/API key for local development.
 * Prints the plaintext API key once.
 */
import { createDb, organizations, projects, apiKeys } from "@agentgauge/db";
import { generateApiKey } from "../lib/api-keys.js";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://agentgauge:agentgauge@localhost:5432/agentgauge";

async function main(): Promise<void> {
  const orgName = process.env.ORG_NAME ?? "Local Development";
  const projectSlug = process.env.PROJECT_SLUG ?? "demo-project";
  const projectName = process.env.PROJECT_NAME ?? "Demo Project";
  const keyName = process.env.KEY_NAME ?? "dev-key";
  const environment = (process.env.KEY_ENV === "test" ? "test" : "live") as "live" | "test";

  const db = createDb(connectionString);

  const org = (await db.insert(organizations).values({ name: orgName }).returning())[0]!;

  const project = (
    await db
      .insert(projects)
      .values({
        organizationId: org.id,
        name: projectName,
        slug: projectSlug,
      })
      .returning()
  )[0]!;

  const key = generateApiKey(environment);
  await db.insert(apiKeys).values({
    organizationId: org.id,
    projectId: project.id,
    name: keyName,
    keyPrefix: key.prefix,
    keyHash: key.hash,
    environment: key.environment,
  });

  console.log(
    JSON.stringify(
      {
        organizationId: org.id,
        organizationName: org.name,
        projectId: project.id,
        projectSlug: project.slug,
        apiKey: key.plaintext,
        keyPrefix: key.prefix,
      },
      null,
      2,
    ),
  );
  console.log("\nStore this API key now. It will not be shown again.");
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
