import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { traces } from "@agentgauge/db";
import { AgentGauge } from "@agentgauge/node";
import { observeAnthropic } from "@agentgauge/anthropic";
import { buildApp } from "./app.js";
import { createTestTenant, type TestTenant } from "./test/helpers.js";
import { InMemoryProjectEventBus } from "./lib/project-event-bus.js";
import type { FastifyInstance } from "fastify";

/**
 * E2E: observeAnthropic → AgentGauge HTTP → API → PostgreSQL → SSE.
 * Anthropic SDK is mocked; no real Anthropic API calls.
 */
describe("E2E Anthropic → API → DB → SSE", () => {
  let app: FastifyInstance;
  let tenant: TestTenant;
  let baseUrl: string;
  let bus: InMemoryProjectEventBus;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    bus = new InMemoryProjectEventBus();
    tenant = await createTestTenant("anthropic-e2e");
    app = await buildApp({ db: tenant.db, rateLimitPerMinute: 10_000, eventBus: bus });
    await app.listen({ port: 0, host: "127.0.0.1" });
    const addr = app.server.address();
    if (!addr || typeof addr === "string") throw new Error("failed to bind");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it("stores anthropic traces with unknown cost and emits trace.created", async () => {
    const seen: string[] = [];
    const unsub = bus.subscribe(tenant.projectId, (e) => seen.push(e.eventId));

    const gauge = new AgentGauge({
      apiKey: tenant.apiKey,
      endpoint: baseUrl,
      project: tenant.projectSlug,
      environment: "test",
    });

    const mockClient = {
      messages: {
        create: vi.fn(async () => ({
          id: "msg_e2e",
          model: "claude-sonnet-fake",
          content: [{ type: "text", text: "should not be stored" }],
          usage: {
            input_tokens: 40,
            output_tokens: 10,
            cache_read_input_tokens: 5,
          },
        })),
      },
    };

    const anthropic = observeAnthropic(mockClient, {
      gauge,
      agentId: "anthropic-e2e-agent",
    });

    await anthropic.messages.create({
      model: "claude-sonnet-fake",
      max_tokens: 64,
      messages: [{ role: "user", content: "hello from test" }],
    });
    await gauge.shutdown();

    await new Promise((r) => setTimeout(r, 50));
    expect(seen.length).toBe(1);
    unsub();

    const rows = await tenant.db.select().from(traces).where(eq(traces.eventId, seen[0]!));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.provider).toBe("anthropic");
    expect(rows[0]!.model).toBe("claude-sonnet-fake");
    expect(rows[0]!.operationName).toBe("anthropic.messages.create");
    expect(rows[0]!.inputTokens).toBe(40);
    expect(rows[0]!.outputTokens).toBe(10);
    expect(rows[0]!.totalTokens).toBe(50);
    expect(rows[0]!.costStatus).toBe("unknown_model");
    expect(rows[0]!.totalCost).toBeNull();
    expect(JSON.stringify(rows[0]!.metadata)).not.toContain("hello from test");
    expect(JSON.stringify(rows[0]!.metadata)).not.toContain("should not be stored");

    const usage = await app.inject({
      method: "GET",
      url: "/v1/usage",
      headers: { authorization: tenant.authHeader },
    });
    expect(usage.statusCode).toBe(200);
    const byProvider = usage.json().byProvider as Array<{ key: string }>;
    expect(byProvider.some((r) => r.key === "anthropic")).toBe(true);

    const list = await app.inject({
      method: "GET",
      url: "/v1/traces?provider=anthropic",
      headers: { authorization: tenant.authHeader },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.some((t: { eventId: string }) => t.eventId === seen[0])).toBe(true);
  });

  it("prices known Anthropic models and surfaces estimated cost via usage API", async () => {
    const seen: string[] = [];
    const unsub = bus.subscribe(tenant.projectId, (e) => seen.push(e.eventId));

    const gauge = new AgentGauge({
      apiKey: tenant.apiKey,
      endpoint: baseUrl,
      project: tenant.projectSlug,
      environment: "test",
    });

    const mockClient = {
      messages: {
        create: vi.fn(async () => ({
          id: "msg_priced",
          model: "claude-sonnet-5-5",
          content: [{ type: "text", text: "secret" }],
          usage: {
            input_tokens: 1_000_000,
            output_tokens: 0,
            cache_read_input_tokens: 50_000,
          },
        })),
      },
    };

    const anthropic = observeAnthropic(mockClient, {
      gauge,
      agentId: "anthropic-priced-agent",
    });

    await anthropic.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 64,
      messages: [{ role: "user", content: "price me" }],
    });
    await gauge.shutdown();
    await new Promise((r) => setTimeout(r, 50));
    unsub();

    const eventId = seen[seen.length - 1]!;
    const rows = await tenant.db.select().from(traces).where(eq(traces.eventId, eventId));
    expect(rows[0]!.costStatus).toBe("priced");
    expect(Number(rows[0]!.totalCost)).toBeCloseTo(2.0, 8);
    expect(Number(rows[0]!.inputCost)).toBeCloseTo(2.0, 8);
    // Cache tokens are metadata only — not added to billed input estimate.
    expect(rows[0]!.inputTokens).toBe(1_000_000);

    const usage = await app.inject({
      method: "GET",
      url: "/v1/usage",
      headers: { authorization: tenant.authHeader },
    });
    expect(usage.statusCode).toBe(200);
    expect(usage.json().estimatedCost).toBeGreaterThanOrEqual(2.0);
  });
});
