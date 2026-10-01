import { and, asc, desc, eq, gte, inArray, lt, lte, sql, type SQL } from "drizzle-orm";
import { agents, runs, traces, type Database, type Project, type Run } from "@agentgauge/db";
import type { TerminalRunStatus } from "@agentgauge/core";
import { findOrCreateAgent, RunNotFoundError } from "./ingest.js";
import { listTraces, type TraceListItem } from "./query.js";

const TERMINAL_STATUSES = new Set<string>(["success", "error", "cancelled", "timeout"]);

export class RunTerminalConflictError extends Error {
  readonly statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = "RunTerminalConflictError";
  }
}

export interface CreateRunInput {
  readonly id?: string;
  readonly name: string;
  readonly agentId: string;
  readonly metadata?: Record<string, unknown>;
  readonly startedAt?: Date;
}

export interface RunSummary {
  readonly id: string;
  readonly name: string;
  readonly agentId: string;
  readonly status: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly requestCount: number;
  readonly totalTokens: number;
  readonly estimatedCost: number;
  readonly hasUnknownCost: boolean;
  readonly errorCount: number;
  readonly retryCount: number;
  readonly durationMs: number;
}

export interface RunDetail extends RunSummary {
  readonly metadata: Record<string, unknown> | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly traces?: TraceListItem[];
}

export interface RunListFilters {
  readonly agentId?: string;
  readonly status?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface RunListResponse {
  readonly data: RunSummary[];
  readonly nextCursor: string | null;
}

export interface EndRunInput {
  readonly status: TerminalRunStatus;
  readonly endedAt?: Date;
  readonly metadata?: Record<string, unknown>;
}

export interface EndRunResult {
  readonly run: RunDetail;
  readonly statusChanged: boolean;
}

export { RunNotFoundError };

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function durationMs(startedAt: Date, endedAt: Date | null, now = new Date()): number {
  const end = endedAt ?? now;
  return Math.max(0, end.getTime() - startedAt.getTime());
}

interface AggregateRow {
  runId: string;
  requestCount: number;
  totalTokens: number;
  estimatedCost: number;
  hasUnknownCost: boolean;
  errorCount: number;
  retryCount: number;
}

async function loadRunAggregates(
  db: Database,
  projectId: string,
  runIds: readonly string[],
): Promise<Map<string, AggregateRow>> {
  const map = new Map<string, AggregateRow>();
  if (runIds.length === 0) return map;

  const baseRows = await db
    .select({
      runId: traces.runId,
      requestCount: sql<number>`count(*)::int`,
      totalTokens: sql<number>`coalesce(sum(${traces.totalTokens}), 0)::bigint`,
      estimatedCost: sql<number>`coalesce(sum(${traces.totalCost}), 0)`,
      hasUnknownCost: sql<boolean>`(count(*) filter (where ${traces.costStatus} = 'unknown_model'))::int > 0`,
      errorCount: sql<number>`count(*) filter (where ${traces.status} = 'error')::int`,
    })
    .from(traces)
    .where(and(eq(traces.projectId, projectId), inArray(traces.runId, [...runIds])))
    .groupBy(traces.runId);

  const retryRows2 = await db.execute<{ run_id: string; retry_count: number }>(sql`
    select run_id, coalesce(sum(greatest(max_attempt - 1, 0)), 0)::int as retry_count
    from (
      select run_id, max(attempt) as max_attempt
      from traces
      where project_id = ${projectId}
        and run_id in (${sql.join(
          runIds.map((id) => sql`${id}`),
          sql`, `,
        )})
        and operation_id is not null
      group by run_id, operation_id
    ) grouped
    group by run_id
  `);

  const retryByRun = new Map<string, number>();
  for (const row of retryRows2) {
    retryByRun.set(row.run_id, num(row.retry_count));
  }

  for (const r of baseRows) {
    if (!r.runId) continue;
    map.set(r.runId, {
      runId: r.runId,
      requestCount: num(r.requestCount),
      totalTokens: num(r.totalTokens),
      estimatedCost: num(r.estimatedCost),
      hasUnknownCost: Boolean(r.hasUnknownCost),
      errorCount: num(r.errorCount),
      retryCount: retryByRun.get(r.runId) ?? 0,
    });
  }

  for (const id of runIds) {
    if (!map.has(id)) {
      map.set(id, {
        runId: id,
        requestCount: 0,
        totalTokens: 0,
        estimatedCost: 0,
        hasUnknownCost: false,
        errorCount: 0,
        retryCount: retryByRun.get(id) ?? 0,
      });
    }
  }

  return map;
}

function emptyAggregate(runId: string): AggregateRow {
  return {
    runId,
    requestCount: 0,
    totalTokens: 0,
    estimatedCost: 0,
    hasUnknownCost: false,
    errorCount: 0,
    retryCount: 0,
  };
}

function toSummary(run: Run, agentKey: string, agg: AggregateRow, now = new Date()): RunSummary {
  return {
    id: run.id,
    name: run.name,
    agentId: agentKey,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    endedAt: run.endedAt?.toISOString() ?? null,
    requestCount: agg.requestCount,
    totalTokens: agg.totalTokens,
    estimatedCost: agg.estimatedCost,
    hasUnknownCost: agg.hasUnknownCost,
    errorCount: agg.errorCount,
    retryCount: agg.retryCount,
    durationMs: durationMs(run.startedAt, run.endedAt, now),
  };
}

function toDetail(
  run: Run,
  agentKey: string,
  agg: AggregateRow,
  tracesPage?: TraceListItem[],
  now = new Date(),
): RunDetail {
  return {
    ...toSummary(run, agentKey, agg, now),
    metadata: run.metadata ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    ...(tracesPage !== undefined ? { traces: tracesPage } : {}),
  };
}

export async function createRun(
  db: Database,
  project: Project,
  input: CreateRunInput,
): Promise<RunDetail> {
  const id = input.id ?? crypto.randomUUID();
  const startedAt = input.startedAt ?? new Date();
  const agent = await findOrCreateAgent(db, project.id, input.agentId, startedAt);

  try {
    const inserted = await db
      .insert(runs)
      .values({
        id,
        projectId: project.id,
        agentId: agent.id,
        name: input.name,
        status: "running",
        startedAt,
        metadata: input.metadata ?? null,
      })
      .returning();
    const run = inserted[0]!;
    return toDetail(run, input.agentId, emptyAggregate(id));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("duplicate") || msg.includes("unique")) {
      throw Object.assign(new Error(`run id "${id}" already exists`), { statusCode: 409 });
    }
    throw error;
  }
}

export async function endRun(
  db: Database,
  projectId: string,
  runId: string,
  input: EndRunInput,
): Promise<EndRunResult> {
  const rows = await db
    .select({
      run: runs,
      agentKey: agents.agentKey,
    })
    .from(runs)
    .innerJoin(agents, eq(agents.id, runs.agentId))
    .where(and(eq(runs.id, runId), eq(runs.projectId, projectId)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new RunNotFoundError(runId);
  }

  const { run, agentKey } = row;

  if (TERMINAL_STATUSES.has(run.status)) {
    if (run.status === input.status) {
      const aggMap = await loadRunAggregates(db, projectId, [runId]);
      const agg = aggMap.get(runId) ?? emptyAggregate(runId);
      return { run: toDetail(run, agentKey, agg), statusChanged: false };
    }
    throw new RunTerminalConflictError(
      `run "${runId}" is already ${run.status}; cannot transition to ${input.status}`,
    );
  }

  if (run.status !== "running") {
    throw new RunTerminalConflictError(`run "${runId}" cannot be ended from status ${run.status}`);
  }

  const endedAt = input.endedAt ?? new Date();
  const mergedMetadata =
    input.metadata !== undefined ? { ...(run.metadata ?? {}), ...input.metadata } : run.metadata;

  const updated = await db
    .update(runs)
    .set({
      status: input.status,
      endedAt,
      metadata: mergedMetadata ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(runs.id, runId), eq(runs.projectId, projectId)))
    .returning();

  const next = updated[0]!;
  const aggMap = await loadRunAggregates(db, projectId, [runId]);
  const agg = aggMap.get(runId) ?? emptyAggregate(runId);
  return { run: toDetail(next, agentKey, agg), statusChanged: true };
}

export async function getRun(
  db: Database,
  projectId: string,
  runId: string,
): Promise<RunDetail | null> {
  const rows = await db
    .select({
      run: runs,
      agentKey: agents.agentKey,
    })
    .from(runs)
    .innerJoin(agents, eq(agents.id, runs.agentId))
    .where(and(eq(runs.id, runId), eq(runs.projectId, projectId)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const aggMap = await loadRunAggregates(db, projectId, [runId]);
  const agg = aggMap.get(runId) ?? emptyAggregate(runId);
  const tracesPage = await listTraces(db, projectId, { runId, limit: 100 });
  return toDetail(row.run, row.agentKey, agg, tracesPage.data);
}

export async function listRuns(
  db: Database,
  projectId: string,
  filters: RunListFilters,
): Promise<RunListResponse> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  const conditions: SQL[] = [eq(runs.projectId, projectId)];

  if (filters.from) conditions.push(gte(runs.startedAt, filters.from));
  if (filters.to) conditions.push(lte(runs.startedAt, filters.to));
  if (filters.status) conditions.push(eq(runs.status, filters.status));
  if (filters.agentId) {
    const agentRows = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.projectId, projectId), eq(agents.agentKey, filters.agentId)))
      .limit(1);
    if (!agentRows[0]) {
      return { data: [], nextCursor: null };
    }
    conditions.push(eq(runs.agentId, agentRows[0].id));
  }
  if (filters.cursor) {
    conditions.push(lt(runs.startedAt, new Date(filters.cursor)));
  }

  const rows = await db
    .select({
      run: runs,
      agentKey: agents.agentKey,
    })
    .from(runs)
    .innerJoin(agents, eq(agents.id, runs.agentId))
    .where(and(...conditions))
    .orderBy(desc(runs.startedAt), asc(runs.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const last = page[page.length - 1];
  const runIds = page.map((r) => r.run.id);
  const aggMap = await loadRunAggregates(db, projectId, runIds);
  const now = new Date();

  return {
    data: page.map((r) =>
      toSummary(r.run, r.agentKey, aggMap.get(r.run.id) ?? emptyAggregate(r.run.id), now),
    ),
    nextCursor: hasMore && last ? last.run.startedAt.toISOString() : null,
  };
}
