import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { createTestTenant, makeTraceEvent, type TestTenant } from "./test/helpers.js";
import { InMemoryProjectEventBus } from "./lib/project-event-bus.js";

async function readSseUntil(
  response: Response,
  predicate: (chunk: string) => boolean,
  timeoutMs = 5_000,
): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    const result = await Promise.race([
      reader.read(),
      new Promise<{ done: true; value?: undefined }>((resolve) =>
        setTimeout(() => resolve({ done: true }), remaining),
      ),
    ]);
    if (result.done && !result.value) break;
    if (result.value) {
      buffer += decoder.decode(result.value, { stream: true });
      if (predicate(buffer)) {
        await reader.cancel().catch(() => undefined);
        return buffer;
      }
    }
  }
  await reader.cancel().catch(() => undefined);
  return buffer;
}

describe("SSE live events", () => {
  let app: FastifyInstance;
  let tenant: TestTenant;
  let baseUrl: string;
  let bus: InMemoryProjectEventBus;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    bus = new InMemoryProjectEventBus();
    tenant = await createTestTenant("sse");
    app = await buildApp({ db: tenant.db, rateLimitPerMinute: 10_000, eventBus: bus });
    await app.listen({ port: 0, host: "127.0.0.1" });
    const addr = app.server.address();
    if (!addr || typeof addr === "string") throw new Error("failed to bind");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects unauthenticated stream connections", async () => {
    const res = await fetch(`${baseUrl}/v1/events/stream`);
    expect(res.status).toBe(401);
  });

  it("rejects revoked API keys", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/v1/api-keys",
      headers: { authorization: tenant.authHeader },
      payload: { name: "temp-stream", environment: "test" },
    });
    const key = created.json().apiKey as string;
    const id = created.json().id as string;
    await app.inject({
      method: "POST",
      url: `/v1/api-keys/${id}/revoke`,
      headers: { authorization: tenant.authHeader },
    });
    const res = await fetch(`${baseUrl}/v1/events/stream`, {
      headers: { authorization: `Bearer ${key}` },
    });
    expect(res.status).toBe(401);
  });

  it("streams trace.created after persistence and cleans up on disconnect", async () => {
    const res = await fetch(`${baseUrl}/v1/events/stream`, {
      headers: { authorization: tenant.authHeader },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(bus.listenerCount(tenant.projectId)).toBe(1);

    const event = makeTraceEvent({
      agentId: "sse-agent",
      model: "gpt-4o-mini",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });

    const ingestPromise = app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: tenant.authHeader },
      payload: { events: [event] },
    });

    const buffer = await readSseUntil(res, (chunk) => chunk.includes("trace.created"));
    const ingest = await ingestPromise;
    expect(ingest.statusCode).toBe(202);
    expect(buffer).toContain("event: trace.created");
    expect(buffer).toContain(event.eventId);
    expect(buffer).toContain("sse-agent");
    expect(buffer).not.toContain(tenant.apiKey);
    expect(buffer).not.toContain("prompt");

    // readSseUntil cancels the stream reader → connection closes → listener removed
    await new Promise((r) => setTimeout(r, 80));
    expect(bus.listenerCount(tenant.projectId)).toBe(0);

    // Duplicate must not notify again
    const dupListenerCalls: string[] = [];
    const unsub = bus.subscribe(tenant.projectId, (e) => dupListenerCalls.push(e.eventId));
    await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: tenant.authHeader },
      payload: { events: [event] },
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(dupListenerCalls).not.toContain(event.eventId);
    unsub();
    expect(bus.listenerCount(tenant.projectId)).toBe(0);
  });

  it("isolates projects on the event bus", async () => {
    const other = await createTestTenant("sse-other");
    const seen: string[] = [];
    const unsub = bus.subscribe(tenant.projectId, (e) => seen.push(e.eventId));

    const foreign = makeTraceEvent({ agentId: "foreign" });
    await buildApp({ db: other.db, eventBus: bus }).then(async (otherApp) => {
      await otherApp.inject({
        method: "POST",
        url: "/v1/traces",
        headers: { authorization: other.authHeader },
        payload: { events: [foreign] },
      });
      await otherApp.close();
    });

    await new Promise((r) => setTimeout(r, 30));
    expect(seen).not.toContain(foreign.eventId);

    const own = makeTraceEvent({ agentId: "own" });
    await app.inject({
      method: "POST",
      url: "/v1/traces",
      headers: { authorization: tenant.authHeader },
      payload: { events: [own] },
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(seen).toContain(own.eventId);
    unsub();
  });
});
