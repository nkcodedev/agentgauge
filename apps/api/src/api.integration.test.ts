import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { agents, traces } from "@agentgauge/db";
import { buildApp } from "./app.js";
import { createTestTenant, makeTraceEvent, type TestTenant } from "./test/helpers.js";
import type { FastifyInstance } from "fastify";

describe("API integration", () => {
  let app: FastifyInstance;
  let tenant: TestTenant;
  let other: TestTenant;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    tenant = await createTestTenant("demo");
    other = await createTestTenant("other");
    app = await buildApp({ db: tenant.db, rateLimitPerMinute: 10_000 });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects missing Authorization", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/traces",
      payload: { events: [makeTraceEvent()] },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects invalid API key", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: "Bearer ag_live_invalid" },
      payload: { events: [makeTraceEvent()] },
    });
    expect(res.statusCode).toBe(401);
  });

  it("ingests a valid trace and prices a known model", async () => {
    const event = makeTraceEvent({ project: tenant.projectSlug });
    const res = await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: tenant.authHeader },
      payload: { events: [event] },
    });
    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.accepted).toBe(true);
    expect(body.eventIds).toContain(event.eventId);

    const rows = await tenant.db.select().from(traces).where(eq(traces.eventId, event.eventId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.costStatus).toBe("priced");
    expect(Number(rows[0]!.totalCost)).toBeCloseTo(0.00045, 8);
    // 1000 * 0.15 / 1e6 + 500 * 0.6 / 1e6 = 0.00015 + 0.0003 = 0.00045
  });

  it("is idempotent on duplicate eventId", async () => {
    const event = makeTraceEvent({ project: tenant.projectSlug });
    const first = await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: tenant.authHeader },
      payload: { events: [event] },
    });
    expect(first.statusCode).toBe(202);

    const second = await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: tenant.authHeader },
      payload: { events: [event] },
    });
    expect(second.statusCode).toBe(202);
    expect(second.json().duplicates).toContain(event.eventId);

    const rows = await tenant.db.select().from(traces).where(eq(traces.eventId, event.eventId));
    expect(rows).toHaveLength(1);
  });

  it("rejects malformed traces (negative tokens)", async () => {
    const event = makeTraceEvent({
      usage: { inputTokens: -1, outputTokens: 1, totalTokens: 0 },
    });
    const res = await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: tenant.authHeader },
      payload: { events: [event] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects oversized metadata", async () => {
    const event = makeTraceEvent({
      metadata: { blob: "x".repeat(9000) },
    });
    const res = await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: tenant.authHeader },
      payload: { events: [event] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("records unknown model with null cost", async () => {
    const event = makeTraceEvent({
      model: "unknown-model-xyz",
      project: tenant.projectSlug,
    });
    const res = await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: tenant.authHeader },
      payload: { events: [event] },
    });
    expect(res.statusCode).toBe(202);
    const rows = await tenant.db.select().from(traces).where(eq(traces.eventId, event.eventId));
    expect(rows[0]!.totalTokens).toBe(1500);
    expect(rows[0]!.totalCost).toBeNull();
    expect(rows[0]!.costStatus).toBe("unknown_model");
  });

  it("auto-creates agents and updates last_seen", async () => {
    const event1 = makeTraceEvent({
      agentId: "auto-agent",
      project: tenant.projectSlug,
      endedAt: "2024-06-01T12:00:00.000Z",
      startedAt: "2024-06-01T11:59:00.000Z",
    });
    await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: tenant.authHeader },
      payload: { events: [event1] },
    });

    const first = await tenant.db.select().from(agents);
    const agent = first.find(
      (a) => a.agentKey === "auto-agent" && a.projectId === tenant.projectId,
    );
    expect(agent).toBeDefined();
    const firstSeen = agent!.firstSeenAt;

    const event2 = makeTraceEvent({
      agentId: "auto-agent",
      project: tenant.projectSlug,
      endedAt: "2024-06-02T12:00:00.000Z",
      startedAt: "2024-06-02T11:59:00.000Z",
    });
    await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: tenant.authHeader },
      payload: { events: [event2] },
    });

    const updated = (await tenant.db.select().from(agents)).find(
      (a) => a.agentKey === "auto-agent" && a.projectId === tenant.projectId,
    )!;
    expect(updated.lastSeenAt.getTime()).toBeGreaterThan(firstSeen.getTime());
  });

  it("enforces project isolation (payload project mismatch)", async () => {
    const event = makeTraceEvent({ project: "someone-elses-project" });
    const res = await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: tenant.authHeader },
      payload: { events: [event] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("project_mismatch");
  });

  it("enforces tenant isolation on usage queries", async () => {
    const event = makeTraceEvent({
      agentId: "iso-agent",
      project: tenant.projectSlug,
      usage: { inputTokens: 10_000, outputTokens: 0, totalTokens: 10_000 },
    });
    await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: tenant.authHeader },
      payload: { events: [event] },
    });

    const otherApp = await buildApp({ db: other.db, rateLimitPerMinute: 10_000 });
    await otherApp.ready();
    try {
      const usage = await otherApp.inject({
        method: "GET",
        url: "/v1/usage",
        headers: { authorization: other.authHeader },
      });
      expect(usage.statusCode).toBe(200);
      expect(usage.json().requests).toBe(0);

      const agentsRes = await otherApp.inject({
        method: "GET",
        url: "/v1/agents",
        headers: { authorization: other.authHeader },
      });
      expect(agentsRes.json().data).toEqual([]);
    } finally {
      await otherApp.close();
    }
  });

  it("aggregates usage and supports date filtering", async () => {
    const event = makeTraceEvent({
      project: tenant.projectSlug,
      agentId: "usage-agent",
      startedAt: "2025-01-15T10:00:00.000Z",
      endedAt: "2025-01-15T10:00:01.000Z",
      usage: { inputTokens: 1_000_000, outputTokens: 0, totalTokens: 1_000_000 },
    });
    await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: tenant.authHeader },
      payload: { events: [event] },
    });

    const inRange = await app.inject({
      method: "GET",
      url: "/v1/usage?from=2025-01-01T00:00:00.000Z&to=2025-02-01T00:00:00.000Z",
      headers: { authorization: tenant.authHeader },
    });
    expect(inRange.statusCode).toBe(200);
    const body = inRange.json();
    expect(body.requests).toBeGreaterThanOrEqual(1);
    expect(body.inputTokens).toBeGreaterThanOrEqual(1_000_000);
    expect(body.estimatedCost).toBeGreaterThanOrEqual(0.15);
    expect(body.byAgent.some((a: { key: string }) => a.key === "usage-agent")).toBe(true);

    const outOfRange = await app.inject({
      method: "GET",
      url: "/v1/usage?from=2020-01-01T00:00:00.000Z&to=2020-02-01T00:00:00.000Z",
      headers: { authorization: tenant.authHeader },
    });
    expect(outOfRange.json().requests).toBe(0);
  });

  it("lists agents and agent detail", async () => {
    const list = await app.inject({
      method: "GET",
      url: "/v1/agents",
      headers: { authorization: tenant.authHeader },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.length).toBeGreaterThan(0);

    const one = await app.inject({
      method: "GET",
      url: "/v1/agents/support-agent",
      headers: { authorization: tenant.authHeader },
    });
    expect(one.statusCode).toBe(200);
    expect(one.json().agentId).toBe("support-agent");
  });

  it("lists traces with filters and pagination", async () => {
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: "POST",
        url: "/v1/traces",
        headers: { authorization: tenant.authHeader },
        payload: {
          events: [
            makeTraceEvent({
              project: tenant.projectSlug,
              agentId: "page-agent",
              model: "gpt-4o",
              startedAt: new Date(Date.UTC(2025, 2, i + 1)).toISOString(),
              endedAt: new Date(Date.UTC(2025, 2, i + 1, 0, 0, 1)).toISOString(),
            }),
          ],
        },
      });
    }

    const page1 = await app.inject({
      method: "GET",
      url: "/v1/traces?agentId=page-agent&limit=2",
      headers: { authorization: tenant.authHeader },
    });
    expect(page1.statusCode).toBe(200);
    const p1 = page1.json();
    expect(p1.data).toHaveLength(2);
    expect(p1.nextCursor).toBeTruthy();

    const page2 = await app.inject({
      method: "GET",
      url: `/v1/traces?agentId=page-agent&limit=2&cursor=${encodeURIComponent(p1.nextCursor)}`,
      headers: { authorization: tenant.authHeader },
    });
    expect(page2.json().data.length).toBeGreaterThanOrEqual(1);

    const filtered = await app.inject({
      method: "GET",
      url: "/v1/traces?model=gpt-4o&status=success",
      headers: { authorization: tenant.authHeader },
    });
    expect(filtered.json().data.every((t: { model: string }) => t.model === "gpt-4o")).toBe(true);
  });

  it("accepts valid batches and rejects malformed batches entirely", async () => {
    const good = makeTraceEvent({ project: tenant.projectSlug });
    const bad = makeTraceEvent({ latencyMs: -5 });
    const res = await app.inject({
      method: "POST",
      url: "/v1/traces/batch",
      headers: { authorization: tenant.authHeader },
      payload: { events: [good, bad] },
    });
    expect(res.statusCode).toBe(400);

    const rows = await tenant.db.select().from(traces).where(eq(traces.eventId, good.eventId));
    expect(rows).toHaveLength(0);

    const ok = await app.inject({
      method: "POST",
      url: "/v1/traces/batch",
      headers: { authorization: tenant.authHeader },
      payload: {
        events: [
          makeTraceEvent({ project: tenant.projectSlug }),
          makeTraceEvent({ project: tenant.projectSlug }),
        ],
      },
    });
    expect(ok.statusCode).toBe(202);
    expect(ok.json().eventIds).toHaveLength(2);
  });

  it("rejects oversized batches", async () => {
    const events = Array.from({ length: 101 }, () => makeTraceEvent());
    const res = await app.inject({
      method: "POST",
      url: "/v1/traces/batch",
      headers: { authorization: tenant.authHeader },
      payload: { events },
    });
    expect(res.statusCode).toBe(400);
  });

  it("accepts synthetic anthropic and google traces and aggregates byProvider", async () => {
    const anthropic = makeTraceEvent({
      project: tenant.projectSlug,
      agentId: "multi-provider-agent",
      provider: "anthropic",
      model: "claude-sonnet-fake",
      operationName: "anthropic.messages.create",
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      metadata: { usageDetails: { cachedInputTokens: 10 } },
    });
    const google = makeTraceEvent({
      project: tenant.projectSlug,
      agentId: "multi-provider-agent",
      provider: "google",
      model: "gemini-fake",
      operationName: "google.models.generateContent",
      usage: { inputTokens: 80, outputTokens: 20, totalTokens: 100 },
      metadata: { usageDetails: { reasoningTokens: 5 } },
    });

    for (const event of [anthropic, google]) {
      const res = await app.inject({
        method: "POST",
        url: "/v1/traces",
        headers: { authorization: tenant.authHeader },
        payload: { events: [event] },
      });
      expect(res.statusCode).toBe(202);

      const rows = await tenant.db.select().from(traces).where(eq(traces.eventId, event.eventId));
      expect(rows).toHaveLength(1);
      expect(rows[0]!.provider).toBe(event.provider);
      expect(rows[0]!.model).toBe(event.model);
      expect(rows[0]!.costStatus).toBe("unknown_model");
      expect(rows[0]!.totalCost).toBeNull();
      expect(rows[0]!.inputTokens).toBe(event.usage.inputTokens);
    }

    const usage = await app.inject({
      method: "GET",
      url: "/v1/usage",
      headers: { authorization: tenant.authHeader },
    });
    expect(usage.statusCode).toBe(200);
    const byProvider = usage.json().byProvider as Array<{ key: string; requests: number }>;
    const keys = byProvider.map((r) => r.key);
    expect(keys).toEqual(expect.arrayContaining(["openai", "anthropic", "google"]));

    const anthropicFilter = await app.inject({
      method: "GET",
      url: "/v1/traces?provider=anthropic",
      headers: { authorization: tenant.authHeader },
    });
    expect(anthropicFilter.statusCode).toBe(200);
    expect(
      anthropicFilter.json().data.every((t: { provider: string }) => t.provider === "anthropic"),
    ).toBe(true);

    const agentsRes = await app.inject({
      method: "GET",
      url: "/v1/agents/multi-provider-agent",
      headers: { authorization: tenant.authHeader },
    });
    expect(agentsRes.statusCode).toBe(200);
    expect(agentsRes.json().requestCount).toBeGreaterThanOrEqual(2);
  });
});
