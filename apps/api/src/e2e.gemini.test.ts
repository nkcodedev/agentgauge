import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { traces } from "@agentgauge/db";
import { AgentGauge } from "@agentgauge/node";
import { observeGemini } from "@agentgauge/gemini";
import { buildApp } from "./app.js";
import { createTestTenant, type TestTenant } from "./test/helpers.js";
import { InMemoryProjectEventBus } from "./lib/project-event-bus.js";
import type { FastifyInstance } from "fastify";

/**
 * E2E: observeGemini → AgentGauge HTTP → API → PostgreSQL → SSE.
 * Google GenAI is mocked; no real Gemini API calls.
 */
describe("E2E Gemini → API → DB → SSE", () => {
  let app: FastifyInstance;
  let tenant: TestTenant;
  let baseUrl: string;
  let bus: InMemoryProjectEventBus;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    bus = new InMemoryProjectEventBus();
    tenant = await createTestTenant("gemini-e2e");
    app = await buildApp({ db: tenant.db, rateLimitPerMinute: 10_000, eventBus: bus });
    await app.listen({ port: 0, host: "127.0.0.1" });
    const addr = app.server.address();
    if (!addr || typeof addr === "string") throw new Error("failed to bind");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it("stores google traces with unknown cost and emits trace.created", async () => {
    const seen: string[] = [];
    const unsub = bus.subscribe(tenant.projectId, (e) => seen.push(e.eventId));

    const gauge = new AgentGauge({
      apiKey: tenant.apiKey,
      endpoint: baseUrl,
      project: tenant.projectSlug,
      environment: "test",
    });

    const mockClient = {
      models: {
        generateContent: vi.fn(async () => ({
          model: "gemini-2.5-flash-fake",
          text: "should not be stored",
          candidates: [{ content: { parts: [{ text: "nope" }] } }],
          usageMetadata: {
            promptTokenCount: 40,
            candidatesTokenCount: 10,
            totalTokenCount: 50,
            thoughtsTokenCount: 2,
          },
        })),
      },
    };

    const ai = observeGemini(mockClient, {
      gauge,
      agentId: "gemini-e2e-agent",
    });

    await ai.models.generateContent({
      model: "gemini-2.5-flash-fake",
      contents: "hello from gemini test",
    });
    await gauge.shutdown();

    await new Promise((r) => setTimeout(r, 50));
    expect(seen.length).toBe(1);
    unsub();

    const rows = await tenant.db.select().from(traces).where(eq(traces.eventId, seen[0]!));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.provider).toBe("google");
    expect(rows[0]!.model).toBe("gemini-2.5-flash-fake");
    expect(rows[0]!.operationName).toBe("google.models.generateContent");
    expect(rows[0]!.inputTokens).toBe(40);
    expect(rows[0]!.outputTokens).toBe(10);
    expect(rows[0]!.totalTokens).toBe(50);
    expect(rows[0]!.costStatus).toBe("unknown_model");
    expect(rows[0]!.totalCost).toBeNull();
    expect(JSON.stringify(rows[0]!.metadata)).not.toContain("hello from gemini test");
    expect(JSON.stringify(rows[0]!.metadata)).not.toContain("should not be stored");

    const usage = await app.inject({
      method: "GET",
      url: "/v1/usage",
      headers: { authorization: tenant.authHeader },
    });
    expect(usage.statusCode).toBe(200);
    const byProvider = usage.json().byProvider as Array<{ key: string }>;
    expect(byProvider.some((r) => r.key === "google")).toBe(true);

    const list = await app.inject({
      method: "GET",
      url: "/v1/traces?provider=google",
      headers: { authorization: tenant.authHeader },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.some((t: { eventId: string }) => t.eventId === seen[0])).toBe(true);
  });

  it("prices known Gemini models and surfaces estimated cost via usage API", async () => {
    const seen: string[] = [];
    const unsub = bus.subscribe(tenant.projectId, (e) => seen.push(e.eventId));

    const gauge = new AgentGauge({
      apiKey: tenant.apiKey,
      endpoint: baseUrl,
      project: tenant.projectSlug,
      environment: "test",
    });

    const mockClient = {
      models: {
        generateContent: vi.fn(async () => ({
          model: "gemini-2.5-flash",
          text: "secret",
          usageMetadata: {
            promptTokenCount: 1_000_000,
            candidatesTokenCount: 0,
            totalTokenCount: 1_000_000,
            thoughtsTokenCount: 12_000,
            cachedContentTokenCount: 100_000,
          },
        })),
      },
    };

    const ai = observeGemini(mockClient, {
      gauge,
      agentId: "gemini-priced-agent",
    });

    await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "price me",
    });
    await gauge.shutdown();
    await new Promise((r) => setTimeout(r, 50));
    unsub();

    const eventId = seen[seen.length - 1]!;
    const rows = await tenant.db.select().from(traces).where(eq(traces.eventId, eventId));
    expect(rows[0]!.costStatus).toBe("priced");
    // 1e6 * 0.30 / 1e6 = 0.30 — reasoning/cache metadata not double-counted
    expect(Number(rows[0]!.totalCost)).toBeCloseTo(0.3, 8);
    expect(rows[0]!.inputTokens).toBe(1_000_000);

    const usage = await app.inject({
      method: "GET",
      url: "/v1/usage",
      headers: { authorization: tenant.authHeader },
    });
    expect(usage.statusCode).toBe(200);
    expect(usage.json().estimatedCost).toBeGreaterThanOrEqual(0.3);
  });
});
