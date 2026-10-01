import { eq } from "drizzle-orm";
import {
  apiKeys,
  organizations,
  projects,
  type ApiKey,
  type Database,
  type Organization,
  type Project,
} from "@agentgauge/db";
import { hashApiKey, parseBearerToken, safeEqualHex } from "../lib/api-keys.js";

export interface AuthContext {
  readonly organization: Organization;
  readonly project: Project;
  readonly apiKey: ApiKey;
}

export async function authenticateRequest(
  db: Database,
  authorizationHeader: string | undefined,
): Promise<AuthContext | null> {
  const token = parseBearerToken(authorizationHeader);
  if (!token || !token.startsWith("ag_")) {
    return null;
  }

  const hash = hashApiKey(token);
  const keyRows = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash)).limit(1);
  const key = keyRows[0];
  if (!key || key.revokedAt) {
    return null;
  }
  if (!safeEqualHex(key.keyHash, hash)) {
    return null;
  }

  const orgRows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, key.organizationId))
    .limit(1);
  const projectRows = await db
    .select()
    .from(projects)
    .where(eq(projects.id, key.projectId))
    .limit(1);

  const organization = orgRows[0];
  const project = projectRows[0];
  if (!organization || !project) {
    return null;
  }

  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));

  return { organization, project, apiKey: key };
}
