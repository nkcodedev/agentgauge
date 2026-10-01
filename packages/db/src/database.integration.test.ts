import { beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import {
  agents,
  apiKeys,
  createDb,
  enrichPendingTraces,
  organizations,
  projects,
  traces,
} from "./index.js";
import { createTestTenant, ensureMigrated, makeTraceEvent } from "./test-helpers.js";

describe("database integration", () => {
  beforeAll(async () => {
    await ensureMigrated();
  });

  it("enforces unique event_id", async () => {
    const tenant = await createTestTenant("dbuniq");
    const agent = (
      await tenant.db
        .insert(agents)
        .values({
          projectId: tenant.projectId,
          agentKey: "db-agent",
        })
        .returning()
    )[0]!;

    const event = makeTraceEvent();
    await tenant.db.insert(traces).values({
      eventId: event.eventId,
      traceId: event.traceId,
      projectId: tenant.projectId,
      agentId: agent.id,
      startedAt: new Date(event.startedAt),
      endedAt: new Date(event.endedAt),
      latencyMs: event.latencyMs,
      status: event.status,
      sdkName: event.sdk.name,
      sdkVersion: event.sdk.version,
      costStatus: "pending",
    });

    await expect(
      tenant.db.insert(traces).values({
        eventId: event.eventId,
        traceId: event.traceId,
        projectId: tenant.projectId,
        agentId: agent.id,
        startedAt: new Date(event.startedAt),
        endedAt: new Date(event.endedAt),
        latencyMs: event.latencyMs,
        status: event.status,
        sdkName: event.sdk.name,
        sdkVersion: event.sdk.version,
        costStatus: "pending",
      }),
    ).rejects.toThrow();
  });

  it("scopes agents uniquely per project", async () => {
    const a = await createTestTenant("dba");
    const b = await createTestTenant("dbb");
    await a.db.insert(agents).values({ projectId: a.projectId, agentKey: "shared" });
    await b.db.insert(agents).values({ projectId: b.projectId, agentKey: "shared" });

    const aAgents = await a.db
      .select()
      .from(agents)
      .where(and(eq(agents.projectId, a.projectId), eq(agents.agentKey, "shared")));
    const bAgents = await b.db
      .select()
      .from(agents)
      .where(and(eq(agents.projectId, b.projectId), eq(agents.agentKey, "shared")));
    expect(aAgents).toHaveLength(1);
    expect(bAgents).toHaveLength(1);
    expect(aAgents[0]!.id).not.toBe(bAgents[0]!.id);
  });

  it("enforces foreign keys", async () => {
    const db = createDb(
      process.env.DATABASE_URL ?? "postgresql://agentgauge:agentgauge@localhost:5432/agentgauge",
    );
    await expect(
      db.insert(projects).values({
        organizationId: "00000000-0000-0000-0000-000000000000",
        name: "x",
        slug: `fk-${crypto.randomUUID().slice(0, 8)}`,
      }),
    ).rejects.toThrow();
  });

  it("worker enrichPendingTraces prices pending rows", async () => {
    const tenant = await createTestTenant("dbworker");
    const agent = (
      await tenant.db
        .insert(agents)
        .values({ projectId: tenant.projectId, agentKey: "pending-agent" })
        .returning()
    )[0]!;

    const eventId = crypto.randomUUID();
    await tenant.db.insert(traces).values({
      eventId,
      traceId: eventId,
      projectId: tenant.projectId,
      agentId: agent.id,
      provider: "openai",
      model: "gpt-4o-mini",
      startedAt: new Date("2024-06-01T00:00:00.000Z"),
      endedAt: new Date("2024-06-01T00:00:01.000Z"),
      latencyMs: 1000,
      status: "success",
      inputTokens: 1_000_000,
      outputTokens: 0,
      totalTokens: 1_000_000,
      sdkName: "@agentgauge/node",
      sdkVersion: "0.3.0",
      costStatus: "pending",
    });

    const updated = await enrichPendingTraces(tenant.db, 10);
    expect(updated).toBeGreaterThanOrEqual(1);

    const row = (await tenant.db.select().from(traces).where(eq(traces.eventId, eventId)))[0]!;
    expect(row.costStatus).toBe("priced");
    expect(Number(row.totalCost)).toBeCloseTo(0.15, 8);
  });

  it("backfills unknown_model Anthropic/Google traces after pricing seeds exist", async () => {
    const tenant = await createTestTenant("dbbackfill");
    const agent = (
      await tenant.db
        .insert(agents)
        .values({ projectId: tenant.projectId, agentKey: "backfill-agent" })
        .returning()
    )[0]!;

    const anthropicId = crypto.randomUUID();
    const googleId = crypto.randomUUID();
    const stillUnknownId = crypto.randomUUID();

    await tenant.db.insert(traces).values([
      {
        eventId: anthropicId,
        traceId: anthropicId,
        projectId: tenant.projectId,
        agentId: agent.id,
        provider: "anthropic",
        model: "claude-sonnet-5-5",
        startedAt: new Date("2026-07-01T00:00:00.000Z"),
        endedAt: new Date("2026-07-01T00:00:01.000Z"),
        latencyMs: 1000,
        status: "success",
        inputTokens: 1_000_000,
        outputTokens: 0,
        totalTokens: 1_000_000,
        sdkName: "@agentgauge/node",
        sdkVersion: "0.5.0",
        costStatus: "unknown_model",
        totalCost: null,
      },
      {
        eventId: googleId,
        traceId: googleId,
        projectId: tenant.projectId,
        agentId: agent.id,
        provider: "google",
        model: "gemini-2.5-flash",
        startedAt: new Date("2026-07-01T00:00:00.000Z"),
        endedAt: new Date("2026-07-01T00:00:01.000Z"),
        latencyMs: 1000,
        status: "success",
        inputTokens: 1_000_000,
        outputTokens: 0,
        totalTokens: 1_000_000,
        sdkName: "@agentgauge/node",
        sdkVersion: "0.5.0",
        costStatus: "unknown_model",
        totalCost: null,
      },
      {
        eventId: stillUnknownId,
        traceId: stillUnknownId,
        projectId: tenant.projectId,
        agentId: agent.id,
        provider: "anthropic",
        model: "claude-not-a-real-model",
        startedAt: new Date("2026-07-01T00:00:00.000Z"),
        endedAt: new Date("2026-07-01T00:00:01.000Z"),
        latencyMs: 1000,
        status: "success",
        inputTokens: 100,
        outputTokens: 10,
        totalTokens: 110,
        sdkName: "@agentgauge/node",
        sdkVersion: "0.5.0",
        costStatus: "unknown_model",
        totalCost: null,
      },
    ]);

    const updated = await enrichPendingTraces(tenant.db, 200);
    expect(updated).toBeGreaterThanOrEqual(2);

    const anthropic = (
      await tenant.db.select().from(traces).where(eq(traces.eventId, anthropicId))
    )[0]!;
    expect(anthropic.costStatus).toBe("priced");
    expect(Number(anthropic.totalCost)).toBeCloseTo(2.0, 8);

    const google = (await tenant.db.select().from(traces).where(eq(traces.eventId, googleId)))[0]!;
    expect(google.costStatus).toBe("priced");
    expect(Number(google.totalCost)).toBeCloseTo(0.3, 8);

    const unknown = (
      await tenant.db.select().from(traces).where(eq(traces.eventId, stillUnknownId))
    )[0]!;
    expect(unknown.costStatus).toBe("unknown_model");
    expect(unknown.totalCost).toBeNull();
  });

  it("stores api key hash not plaintext", async () => {
    const tenant = await createTestTenant("dbkeys");
    const keys = await tenant.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.projectId, tenant.projectId));
    expect(keys[0]!.keyHash).not.toContain(tenant.apiKey);
    expect(keys[0]!.keyHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("cascades organization delete", async () => {
    const tenant = await createTestTenant("dbcascade");
    await tenant.db.delete(organizations).where(eq(organizations.id, tenant.organizationId));
    const remaining = await tenant.db
      .select({ c: sql<number>`count(*)::int` })
      .from(projects)
      .where(eq(projects.id, tenant.projectId));
    expect(remaining[0]!.c).toBe(0);
  });
});
