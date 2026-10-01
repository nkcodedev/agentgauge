import { and, asc, desc, eq, gte, lt, lte, sql, type SQL } from "drizzle-orm";
import { agents, traces, type Database } from "@agentgauge/db";

export interface DateRange {
  readonly from?: Date;
  readonly to?: Date;
}

export interface UsageBreakdownRow {
  readonly key: string;
  readonly requests: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly estimatedCost: number;
  readonly errors: number;
  readonly averageLatencyMs: number;
}

export interface UsageResponse {
  readonly from: string | null;
  readonly to: string | null;
  readonly requests: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly estimatedCost: number;
  readonly errors: number;
  readonly averageLatencyMs: number;
  readonly byAgent: UsageBreakdownRow[];
  readonly byModel: UsageBreakdownRow[];
  readonly byProvider: UsageBreakdownRow[];
}

function rangeFilters(projectId: string, range: DateRange): SQL[] {
  const filters: SQL[] = [eq(traces.projectId, projectId)];
  if (range.from) filters.push(gte(traces.startedAt, range.from));
  if (range.to) filters.push(lte(traces.startedAt, range.to));
  return filters;
}

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function getUsage(
  db: Database,
  projectId: string,
  range: DateRange,
): Promise<UsageResponse> {
  const where = and(...rangeFilters(projectId, range));

  const totals = await db
    .select({
      requests: sql<number>`count(*)::int`,
      inputTokens: sql<number>`coalesce(sum(${traces.inputTokens}), 0)::bigint`,
      outputTokens: sql<number>`coalesce(sum(${traces.outputTokens}), 0)::bigint`,
      totalTokens: sql<number>`coalesce(sum(${traces.totalTokens}), 0)::bigint`,
      estimatedCost: sql<number>`coalesce(sum(${traces.totalCost}), 0)`,
      errors: sql<number>`count(*) filter (where ${traces.status} = 'error')::int`,
      averageLatencyMs: sql<number>`coalesce(avg(${traces.latencyMs}), 0)`,
    })
    .from(traces)
    .where(where);

  const t = totals[0]!;

  const byAgentRows = await db
    .select({
      key: agents.agentKey,
      requests: sql<number>`count(*)::int`,
      inputTokens: sql<number>`coalesce(sum(${traces.inputTokens}), 0)::bigint`,
      outputTokens: sql<number>`coalesce(sum(${traces.outputTokens}), 0)::bigint`,
      totalTokens: sql<number>`coalesce(sum(${traces.totalTokens}), 0)::bigint`,
      estimatedCost: sql<number>`coalesce(sum(${traces.totalCost}), 0)`,
      errors: sql<number>`count(*) filter (where ${traces.status} = 'error')::int`,
      averageLatencyMs: sql<number>`coalesce(avg(${traces.latencyMs}), 0)`,
    })
    .from(traces)
    .innerJoin(agents, eq(agents.id, traces.agentId))
    .where(where)
    .groupBy(agents.agentKey)
    .orderBy(desc(sql`count(*)`));

  const byModelRows = await db
    .select({
      key: sql<string>`coalesce(${traces.model}, 'unknown')`,
      requests: sql<number>`count(*)::int`,
      inputTokens: sql<number>`coalesce(sum(${traces.inputTokens}), 0)::bigint`,
      outputTokens: sql<number>`coalesce(sum(${traces.outputTokens}), 0)::bigint`,
      totalTokens: sql<number>`coalesce(sum(${traces.totalTokens}), 0)::bigint`,
      estimatedCost: sql<number>`coalesce(sum(${traces.totalCost}), 0)`,
      errors: sql<number>`count(*) filter (where ${traces.status} = 'error')::int`,
      averageLatencyMs: sql<number>`coalesce(avg(${traces.latencyMs}), 0)`,
    })
    .from(traces)
    .where(where)
    .groupBy(sql`coalesce(${traces.model}, 'unknown')`)
    .orderBy(desc(sql`count(*)`));

  const byProviderRows = await db
    .select({
      key: sql<string>`coalesce(${traces.provider}, 'unknown')`,
      requests: sql<number>`count(*)::int`,
      inputTokens: sql<number>`coalesce(sum(${traces.inputTokens}), 0)::bigint`,
      outputTokens: sql<number>`coalesce(sum(${traces.outputTokens}), 0)::bigint`,
      totalTokens: sql<number>`coalesce(sum(${traces.totalTokens}), 0)::bigint`,
      estimatedCost: sql<number>`coalesce(sum(${traces.totalCost}), 0)`,
      errors: sql<number>`count(*) filter (where ${traces.status} = 'error')::int`,
      averageLatencyMs: sql<number>`coalesce(avg(${traces.latencyMs}), 0)`,
    })
    .from(traces)
    .where(where)
    .groupBy(sql`coalesce(${traces.provider}, 'unknown')`)
    .orderBy(desc(sql`count(*)`));

  const mapRow = (r: {
    key: string;
    requests: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
    errors: number;
    averageLatencyMs: number;
  }): UsageBreakdownRow => ({
    key: r.key,
    requests: num(r.requests),
    inputTokens: num(r.inputTokens),
    outputTokens: num(r.outputTokens),
    totalTokens: num(r.totalTokens),
    estimatedCost: num(r.estimatedCost),
    errors: num(r.errors),
    averageLatencyMs: Math.round(num(r.averageLatencyMs)),
  });

  return {
    from: range.from?.toISOString() ?? null,
    to: range.to?.toISOString() ?? null,
    requests: num(t.requests),
    inputTokens: num(t.inputTokens),
    outputTokens: num(t.outputTokens),
    totalTokens: num(t.totalTokens),
    estimatedCost: num(t.estimatedCost),
    errors: num(t.errors),
    averageLatencyMs: Math.round(num(t.averageLatencyMs)),
    byAgent: byAgentRows.map(mapRow),
    byModel: byModelRows.map(mapRow),
    byProvider: byProviderRows.map(mapRow),
  };
}

export interface AgentSummary {
  readonly agentId: string;
  readonly firstSeen: string;
  readonly lastSeen: string;
  readonly requestCount: number;
  readonly totalTokens: number;
  readonly estimatedCost: number;
  readonly errorCount: number;
  readonly averageLatencyMs: number;
}

export async function listAgents(db: Database, projectId: string): Promise<AgentSummary[]> {
  const rows = await db
    .select({
      agentId: agents.agentKey,
      firstSeen: agents.firstSeenAt,
      lastSeen: agents.lastSeenAt,
      requestCount: sql<number>`count(${traces.id})::int`,
      totalTokens: sql<number>`coalesce(sum(${traces.totalTokens}), 0)::bigint`,
      estimatedCost: sql<number>`coalesce(sum(${traces.totalCost}), 0)`,
      errorCount: sql<number>`count(*) filter (where ${traces.status} = 'error')::int`,
      averageLatencyMs: sql<number>`coalesce(avg(${traces.latencyMs}), 0)`,
    })
    .from(agents)
    .leftJoin(traces, and(eq(traces.agentId, agents.id), eq(traces.projectId, projectId)))
    .where(eq(agents.projectId, projectId))
    .groupBy(agents.id)
    .orderBy(desc(agents.lastSeenAt));

  return rows.map((r) => ({
    agentId: r.agentId,
    firstSeen: r.firstSeen.toISOString(),
    lastSeen: r.lastSeen.toISOString(),
    requestCount: num(r.requestCount),
    totalTokens: num(r.totalTokens),
    estimatedCost: num(r.estimatedCost),
    errorCount: num(r.errorCount),
    averageLatencyMs: Math.round(num(r.averageLatencyMs)),
  }));
}

export async function getAgent(
  db: Database,
  projectId: string,
  agentKey: string,
): Promise<AgentSummary | null> {
  const all = await listAgents(db, projectId);
  return all.find((a) => a.agentId === agentKey) ?? null;
}

export interface TraceFilters extends DateRange {
  readonly agentId?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly status?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface TraceListItem {
  readonly eventId: string;
  readonly traceId: string;
  readonly agentId: string;
  readonly provider: string | null;
  readonly model: string | null;
  readonly status: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly latencyMs: number;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly totalTokens: number | null;
  readonly totalCost: string | null;
  readonly currency: string | null;
}

export interface TraceListResponse {
  readonly data: TraceListItem[];
  readonly nextCursor: string | null;
}

export async function listTraces(
  db: Database,
  projectId: string,
  filters: TraceFilters,
): Promise<TraceListResponse> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  const conditions: SQL[] = [eq(traces.projectId, projectId)];

  if (filters.from) conditions.push(gte(traces.startedAt, filters.from));
  if (filters.to) conditions.push(lte(traces.startedAt, filters.to));
  if (filters.provider) conditions.push(eq(traces.provider, filters.provider));
  if (filters.model) conditions.push(eq(traces.model, filters.model));
  if (filters.status) conditions.push(eq(traces.status, filters.status));
  if (filters.agentId) {
    const agentRows = await db
      .select()
      .from(agents)
      .where(and(eq(agents.projectId, projectId), eq(agents.agentKey, filters.agentId)))
      .limit(1);
    if (!agentRows[0]) {
      return { data: [], nextCursor: null };
    }
    conditions.push(eq(traces.agentId, agentRows[0].id));
  }
  if (filters.cursor) {
    conditions.push(lt(traces.startedAt, new Date(filters.cursor)));
  }

  const rows = await db
    .select({
      eventId: traces.eventId,
      traceId: traces.traceId,
      agentKey: agents.agentKey,
      provider: traces.provider,
      model: traces.model,
      status: traces.status,
      startedAt: traces.startedAt,
      endedAt: traces.endedAt,
      latencyMs: traces.latencyMs,
      inputTokens: traces.inputTokens,
      outputTokens: traces.outputTokens,
      totalTokens: traces.totalTokens,
      totalCost: traces.totalCost,
      currency: traces.currency,
    })
    .from(traces)
    .innerJoin(agents, eq(agents.id, traces.agentId))
    .where(and(...conditions))
    .orderBy(desc(traces.startedAt), asc(traces.eventId))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const last = page[page.length - 1];

  return {
    data: page.map((r) => ({
      eventId: r.eventId,
      traceId: r.traceId,
      agentId: r.agentKey,
      provider: r.provider,
      model: r.model,
      status: r.status,
      startedAt: r.startedAt.toISOString(),
      endedAt: r.endedAt.toISOString(),
      latencyMs: r.latencyMs,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      totalTokens: r.totalTokens,
      totalCost: r.totalCost !== null ? String(r.totalCost) : null,
      currency: r.currency,
    })),
    nextCursor: hasMore && last ? last.startedAt.toISOString() : null,
  };
}
