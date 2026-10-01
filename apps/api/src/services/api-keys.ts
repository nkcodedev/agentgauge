import { and, desc, eq, isNull } from "drizzle-orm";
import { apiKeys, type Database } from "@agentgauge/db";
import { generateApiKey, type ApiKeyEnvironment } from "../lib/api-keys.js";

export interface ApiKeyListItem {
  readonly id: string;
  readonly name: string;
  readonly prefix: string;
  readonly environment: string;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
  readonly revokedAt: string | null;
}

export interface CreatedApiKey extends ApiKeyListItem {
  /** Plaintext returned only at creation time. */
  readonly apiKey: string;
}

export async function listApiKeys(db: Database, projectId: string): Promise<ApiKeyListItem[]> {
  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.projectId, projectId))
    .orderBy(desc(apiKeys.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    prefix: r.keyPrefix,
    environment: r.environment,
    createdAt: r.createdAt.toISOString(),
    lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
    revokedAt: r.revokedAt?.toISOString() ?? null,
  }));
}

export async function createApiKey(
  db: Database,
  organizationId: string,
  projectId: string,
  input: { name: string; environment?: ApiKeyEnvironment },
): Promise<CreatedApiKey> {
  const name = input.name.trim();
  if (name.length === 0 || name.length > 128) {
    throw Object.assign(new Error("name must be 1–128 characters"), { statusCode: 400 });
  }
  const environment = input.environment ?? "live";
  const key = generateApiKey(environment);
  const inserted = await db
    .insert(apiKeys)
    .values({
      organizationId,
      projectId,
      name,
      keyPrefix: key.prefix,
      keyHash: key.hash,
      environment: key.environment,
    })
    .returning();
  const row = inserted[0]!;
  return {
    id: row.id,
    name: row.name,
    prefix: row.keyPrefix,
    environment: row.environment,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: null,
    revokedAt: null,
    apiKey: key.plaintext,
  };
}

export async function revokeApiKey(
  db: Database,
  projectId: string,
  keyId: string,
): Promise<ApiKeyListItem | null> {
  const existing = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.projectId, projectId)))
    .limit(1);
  const row = existing[0];
  if (!row) return null;
  if (row.revokedAt) {
    return {
      id: row.id,
      name: row.name,
      prefix: row.keyPrefix,
      environment: row.environment,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt.toISOString(),
    };
  }
  const updated = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.projectId, projectId), isNull(apiKeys.revokedAt)))
    .returning();
  const u = updated[0]!;
  return {
    id: u.id,
    name: u.name,
    prefix: u.keyPrefix,
    environment: u.environment,
    createdAt: u.createdAt.toISOString(),
    lastUsedAt: u.lastUsedAt?.toISOString() ?? null,
    revokedAt: u.revokedAt?.toISOString() ?? null,
  };
}
