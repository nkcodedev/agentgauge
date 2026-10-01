import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { createTestTenant, makeTraceEvent, type TestTenant } from "./test/helpers.js";

describe("runs API", () => {
  let app: FastifyInstance;
  let tenant: TestTenant;
  let other: TestTenant;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    tenant = await createTestTenant("runs");
    other = await createTestTenant("runs-other");
    app = await buildApp({ db: tenant.db, rateLimitPerMinute: 10_000 });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  async function createRun(overrides: Record<string, unknown> = {}, auth = tenant.authHeader) {
    const body = {
      id: `run-${crypto.randomUUID()}`,
      name: "test-run",
      agentId: "support-agent",
      ...overrides,
    };
    const res = await app.inject({
      method: "POST",
      url: "/v1/runs",
      headers: { authorization: auth },
      payload: body,
    });
    return { res, body };
  }

  it("creates, lists, gets, and ends a run", async () => {
    const startedAt = "2024-06-01T10:00:00.000Z";
    const { res: created, body: createBody } = await createRun({
      startedAt,
      metadata: { tier: "pro" },
    });
    expect(created.statusCode).toBe(201);
    const run = created.json();
    expect(run.id).toBe(createBody.id);
    expect(run.status).toBe("running");
    expect(run.agentId).toBe("support-agent");
    expect(run.metadata).toEqual({ tier: "pro" });
    expect(run.requestCount).toBe(0);

    const list = await app.inject({
      method: "GET",
      url: "/v1/runs",
      headers: { authorization: tenant.authHeader },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.some((r: { id: string }) => r.id === run.id)).toBe(true);

    const one = await app.inject({
      method: "GET",
      url: `/v1/runs/${run.id}`,
      headers: { authorization: tenant.authHeader },
    });
    expect(one.statusCode).toBe(200);
    expect(one.json().traces).toEqual([]);

    const endedAt = "2024-06-01T10:05:00.000Z";
    const end = await app.inject({
      method: "POST",
      url: `/v1/runs/${run.id}/end`,
      headers: { authorization: tenant.authHeader },
      payload: { status: "success", endedAt },
    });
    expect(end.statusCode).toBe(200);
    const ended = end.json();
    expect(ended.status).toBe("success");
    expect(ended.endedAt).toBe(endedAt);
    expect(ended.durationMs).toBe(5 * 60 * 1000);
  });

  it("attaches traces to a run and aggregates metrics", async () => {
    const { res: created, body: createBody } = await createRun({ agentId: "run-agent" });
    expect(created.statusCode).toBe(201);
    const runId = createBody.id as string;

    const priced = makeTraceEvent({
      agentId: "run-agent",
      runId,
      project: tenant.projectSlug,
      model: "gpt-4o-mini",
    });
    const unknown = makeTraceEvent({
      agentId: "run-agent",
      runId,
      project: tenant.projectSlug,
      model: "unknown-model-xyz",
    });

    await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: tenant.authHeader },
      payload: { events: [priced, unknown] },
    });

    const detail = await app.inject({
      method: "GET",
      url: `/v1/runs/${runId}`,
      headers: { authorization: tenant.authHeader },
    });
    const body = detail.json();
    expect(body.requestCount).toBe(2);
    expect(body.totalTokens).toBe(3000);
    expect(body.estimatedCost).toBeCloseTo(0.00045, 8);
    expect(body.hasUnknownCost).toBe(true);
    expect(body.traces).toHaveLength(2);

    const filtered = await app.inject({
      method: "GET",
      url: `/v1/traces?runId=${encodeURIComponent(runId)}`,
      headers: { authorization: tenant.authHeader },
    });
    expect(filtered.json().data).toHaveLength(2);
    expect(filtered.json().data[0].runId).toBe(runId);
  });

  it("rejects agent mismatch on ingest", async () => {
    const { body: createBody } = await createRun({ agentId: "owner-agent" });
    const runId = createBody.id as string;
    const event = makeTraceEvent({
      agentId: "other-agent",
      runId,
      project: tenant.projectSlug,
    });
    const res = await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: tenant.authHeader },
      payload: { events: [event] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain("does not match");
  });

  it("rejects missing run on ingest", async () => {
    const event = makeTraceEvent({
      runId: "missing-run-id",
      project: tenant.projectSlug,
    });
    const res = await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: tenant.authHeader },
      payload: { events: [event] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("isolates runs by project", async () => {
    const { body: createBody } = await createRun();
    const runId = createBody.id as string;
    const foreign = await app.inject({
      method: "GET",
      url: `/v1/runs/${runId}`,
      headers: { authorization: other.authHeader },
    });
    expect(foreign.statusCode).toBe(404);
  });

  it("filters and paginates runs", async () => {
    const a = await createRun({
      id: `run-a-${crypto.randomUUID()}`,
      agentId: "paginate-agent",
      startedAt: "2024-01-03T00:00:00.000Z",
    });
    const b = await createRun({
      id: `run-b-${crypto.randomUUID()}`,
      agentId: "paginate-agent",
      startedAt: "2024-01-02T00:00:00.000Z",
    });
    expect(a.res.statusCode).toBe(201);
    expect(b.res.statusCode).toBe(201);

    await app.inject({
      method: "POST",
      url: `/v1/runs/${a.body.id}/end`,
      headers: { authorization: tenant.authHeader },
      payload: { status: "success" },
    });

    const byAgent = await app.inject({
      method: "GET",
      url: "/v1/runs?agentId=paginate-agent&status=success",
      headers: { authorization: tenant.authHeader },
    });
    expect(byAgent.json().data.every((r: { status: string }) => r.status === "success")).toBe(true);

    const page1 = await app.inject({
      method: "GET",
      url: "/v1/runs?agentId=paginate-agent&limit=1",
      headers: { authorization: tenant.authHeader },
    });
    const p1 = page1.json();
    expect(p1.data).toHaveLength(1);
    expect(p1.nextCursor).toBeTruthy();

    const page2 = await app.inject({
      method: "GET",
      url: `/v1/runs?agentId=paginate-agent&limit=1&cursor=${encodeURIComponent(p1.nextCursor)}`,
      headers: { authorization: tenant.authHeader },
    });
    expect(page2.json().data).toHaveLength(1);
    expect(page2.json().data[0].id).not.toBe(p1.data[0].id);
  });

  it("counts errors and retries from operation attempts", async () => {
    const { body: createBody } = await createRun({ agentId: "retry-agent" });
    const runId = createBody.id as string;
    const op = "op-retry-1";
    for (const [attempt, status] of [
      [1, "error"],
      [2, "error"],
      [3, "success"],
    ] as const) {
      await app.inject({
        method: "POST",
        url: "/v1/traces",
        headers: { authorization: tenant.authHeader },
        payload: {
          events: [
            makeTraceEvent({
              agentId: "retry-agent",
              runId,
              operationId: op,
              attempt,
              status,
              project: tenant.projectSlug,
            }),
          ],
        },
      });
    }

    await app.inject({
      method: "POST",
      url: `/v1/runs/${runId}/end`,
      headers: { authorization: tenant.authHeader },
      payload: { status: "success" },
    });

    const detail = await app.inject({
      method: "GET",
      url: `/v1/runs/${runId}`,
      headers: { authorization: tenant.authHeader },
    });
    const body = detail.json();
    expect(body.retryCount).toBe(2);
    expect(body.errorCount).toBe(2);
    expect(body.status).toBe("success");
  });

  it("allows timeout status when child traces succeeded", async () => {
    const { body: createBody } = await createRun({ agentId: "timeout-agent" });
    const runId = createBody.id as string;
    await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: tenant.authHeader },
      payload: {
        events: [
          makeTraceEvent({
            agentId: "timeout-agent",
            runId,
            status: "success",
            project: tenant.projectSlug,
          }),
        ],
      },
    });
    const end = await app.inject({
      method: "POST",
      url: `/v1/runs/${runId}/end`,
      headers: { authorization: tenant.authHeader },
      payload: { status: "timeout" },
    });
    expect(end.statusCode).toBe(200);
    expect(end.json().status).toBe("timeout");
    expect(end.json().errorCount).toBe(0);
  });

  it("rejects conflicting terminal transition", async () => {
    const { body: createBody } = await createRun();
    const runId = createBody.id as string;
    await app.inject({
      method: "POST",
      url: `/v1/runs/${runId}/end`,
      headers: { authorization: tenant.authHeader },
      payload: { status: "success" },
    });
    const again = await app.inject({
      method: "POST",
      url: `/v1/runs/${runId}/end`,
      headers: { authorization: tenant.authHeader },
      payload: { status: "error" },
    });
    expect(again.statusCode).toBe(409);
  });

  it("is idempotent when ending with the same terminal status", async () => {
    const { body: createBody } = await createRun();
    const runId = createBody.id as string;
    await app.inject({
      method: "POST",
      url: `/v1/runs/${runId}/end`,
      headers: { authorization: tenant.authHeader },
      payload: { status: "cancelled" },
    });
    const dup = await app.inject({
      method: "POST",
      url: `/v1/runs/${runId}/end`,
      headers: { authorization: tenant.authHeader },
      payload: { status: "cancelled" },
    });
    expect(dup.statusCode).toBe(200);
    expect(dup.json().status).toBe("cancelled");
  });
});
