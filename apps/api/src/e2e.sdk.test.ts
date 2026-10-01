import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AgentGauge } from "@agentgauge/node";
import { buildApp } from "./app.js";
import { createTestTenant, type TestTenant } from "./test/helpers.js";
import type { FastifyInstance } from "fastify";

/**
 * End-to-end: SDK → HTTP transport → API → PostgreSQL → cost → usage.
 */
describe("E2E SDK → API → DB → usage", () => {
  let app: FastifyInstance;
  let tenant: TestTenant;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    tenant = await createTestTenant("e2e");
    app = await buildApp({ db: tenant.db, rateLimitPerMinute: 10_000 });
    await app.listen({ port: 0, host: "127.0.0.1" });
    const addr = app.server.address();
    if (!addr || typeof addr === "string") throw new Error("failed to bind");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it("traces through the hosted API and appears in usage", async () => {
    const gauge = new AgentGauge({
      apiKey: tenant.apiKey,
      endpoint: baseUrl,
      project: tenant.projectSlug,
      environment: "test",
    });

    const trace = gauge.startTrace({
      agentId: "e2e-agent",
      provider: "openai",
      model: "gpt-4o-mini",
      operationName: "e2e-test",
    });
    trace.end({ inputTokens: 2_000_000, outputTokens: 1_000_000 });
    await gauge.shutdown();

    // Idempotency: re-send same event should not duplicate — covered elsewhere;
    // here verify usage aggregates cost: 2e6*0.15/1e6 + 1e6*0.6/1e6 = 0.3 + 0.6 = 0.9
    const usageRes = await app.inject({
      method: "GET",
      url: "/v1/usage",
      headers: { authorization: tenant.authHeader },
    });
    expect(usageRes.statusCode).toBe(200);
    const usage = usageRes.json();
    expect(usage.requests).toBe(1);
    expect(usage.inputTokens).toBe(2_000_000);
    expect(usage.outputTokens).toBe(1_000_000);
    expect(usage.totalTokens).toBe(3_000_000);
    expect(usage.estimatedCost).toBeCloseTo(0.9, 6);
    expect(usage.byAgent.some((a: { key: string }) => a.key === "e2e-agent")).toBe(true);

    const agentsRes = await app.inject({
      method: "GET",
      url: "/v1/agents/e2e-agent",
      headers: { authorization: tenant.authHeader },
    });
    expect(agentsRes.statusCode).toBe(200);
    expect(agentsRes.json().requestCount).toBe(1);
    expect(agentsRes.json().estimatedCost).toBeCloseTo(0.9, 6);

    // Tenant isolation: other project key sees nothing
    const other = await createTestTenant("e2e-other");
    const iso = await app.inject({
      method: "GET",
      url: "/v1/usage",
      headers: { authorization: other.authHeader },
    });
    expect(iso.json().requests).toBe(0);
  });
});
