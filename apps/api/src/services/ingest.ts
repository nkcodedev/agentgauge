import { and, eq } from "drizzle-orm";
import {
  agents,
  calculateCost,
  modelPricing,
  traces,
  type Database,
  type PricingRow,
  type Project,
} from "@agentgauge/db";
import type { IngestTraceEvent } from "../lib/trace-schema.js";

export class ProjectMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectMismatchError";
  }
}

async function loadPricing(db: Database): Promise<PricingRow[]> {
  const rows = await db.select().from(modelPricing);
  return rows.map((r) => ({
    provider: r.provider,
    model: r.model,
    inputPricePerMillion: String(r.inputPricePerMillion),
    outputPricePerMillion: String(r.outputPricePerMillion),
    currency: r.currency,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
  }));
}

export async function findOrCreateAgent(
  db: Database,
  projectId: string,
  agentKey: string,
  seenAt: Date,
): Promise<{ id: string; created: boolean }> {
  const existing = await db
    .select()
    .from(agents)
    .where(and(eq(agents.projectId, projectId), eq(agents.agentKey, agentKey)))
    .limit(1);

  if (existing[0]) {
    await db.update(agents).set({ lastSeenAt: seenAt }).where(eq(agents.id, existing[0].id));
    return { id: existing[0].id, created: false };
  }

  try {
    const inserted = await db
      .insert(agents)
      .values({
        projectId,
        agentKey,
        displayName: agentKey,
        firstSeenAt: seenAt,
        lastSeenAt: seenAt,
      })
      .returning();
    return { id: inserted[0]!.id, created: true };
  } catch {
    const again = await db
      .select()
      .from(agents)
      .where(and(eq(agents.projectId, projectId), eq(agents.agentKey, agentKey)))
      .limit(1);
    if (!again[0]) throw new Error("Failed to create or find agent");
    await db.update(agents).set({ lastSeenAt: seenAt }).where(eq(agents.id, again[0].id));
    return { id: again[0].id, created: false };
  }
}

export interface IngestResult {
  readonly eventId: string;
  readonly duplicate: boolean;
}

/**
 * Persist a validated TraceEvent for the authenticated project.
 * Cost is enriched synchronously on ingest; worker handles any leftover pending rows.
 * Duplicate eventId → idempotent no-op.
 */
export async function ingestEvent(
  db: Database,
  project: Project,
  event: IngestTraceEvent,
): Promise<IngestResult> {
  if (event.project !== undefined && event.project !== project.slug) {
    throw new ProjectMismatchError(
      `payload project "${event.project}" does not match API key project "${project.slug}"`,
    );
  }

  const existing = await db
    .select({ id: traces.id })
    .from(traces)
    .where(eq(traces.eventId, event.eventId))
    .limit(1);
  if (existing[0]) {
    return { eventId: event.eventId, duplicate: true };
  }

  const startedAt = new Date(event.startedAt);
  const endedAt = new Date(event.endedAt);
  const agent = await findOrCreateAgent(db, project.id, event.agentId, endedAt);

  const pricingRows = await loadPricing(db);
  const cost = calculateCost(
    {
      ...(event.provider ? { provider: event.provider } : {}),
      ...(event.model ? { model: event.model } : {}),
      ...(event.usage?.inputTokens !== undefined ? { inputTokens: event.usage.inputTokens } : {}),
      ...(event.usage?.outputTokens !== undefined
        ? { outputTokens: event.usage.outputTokens }
        : {}),
      timestamp: startedAt,
    },
    pricingRows,
  );

  const costStatus =
    cost.status === "priced" ? "priced" : cost.status === "no_usage" ? "no_usage" : "unknown_model";

  try {
    await db.insert(traces).values({
      eventId: event.eventId,
      traceId: event.traceId,
      projectId: project.id,
      agentId: agent.id,
      environment: event.environment ?? null,
      provider: event.provider ?? null,
      model: event.model ?? null,
      operationName: event.operationName ?? null,
      startedAt,
      endedAt,
      latencyMs: event.latencyMs,
      status: event.status,
      inputTokens: event.usage?.inputTokens ?? null,
      outputTokens: event.usage?.outputTokens ?? null,
      totalTokens: event.usage?.totalTokens ?? null,
      errorName: event.error?.name ?? null,
      errorMessage: event.error?.message ?? null,
      errorCode: event.error?.code ?? null,
      metadata: event.metadata ?? null,
      tags: event.tags ? [...event.tags] : null,
      sdkName: event.sdk.name,
      sdkVersion: event.sdk.version,
      inputCost: cost.inputCost,
      outputCost: cost.outputCost,
      totalCost: cost.totalCost,
      currency: cost.currency,
      costStatus,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("traces_event_id_uidx") || msg.includes("unique")) {
      return { eventId: event.eventId, duplicate: true };
    }
    throw error;
  }

  return { eventId: event.eventId, duplicate: false };
}
