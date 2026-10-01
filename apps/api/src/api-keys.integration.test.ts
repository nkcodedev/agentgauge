import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { createTestTenant, type TestTenant } from "./test/helpers.js";
import { eq } from "drizzle-orm";
import { apiKeys } from "@agentgauge/db";

describe("API key management", () => {
  let app: FastifyInstance;
  let tenant: TestTenant;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    tenant = await createTestTenant("keys");
    app = await buildApp({ db: tenant.db, rateLimitPerMinute: 10_000 });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("lists, creates, and revokes keys with one-time plaintext", async () => {
    const list = await app.inject({
      method: "GET",
      url: "/v1/api-keys",
      headers: { authorization: tenant.authHeader },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.length).toBeGreaterThanOrEqual(1);

    const created = await app.inject({
      method: "POST",
      url: "/v1/api-keys",
      headers: { authorization: tenant.authHeader },
      payload: { name: "dashboard-key", environment: "test" },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json();
    expect(body.apiKey).toMatch(/^ag_test_/);
    expect(body.prefix).toBe(body.apiKey.slice(0, 16));
    expect(JSON.stringify(body)).not.toContain("keyHash");

    const rows = await tenant.db.select().from(apiKeys).where(eq(apiKeys.id, body.id));
    expect(rows[0]!.keyHash).not.toBe(body.apiKey);
    expect(rows[0]!.keyHash).toMatch(/^[a-f0-9]{64}$/);

    const list2 = await app.inject({
      method: "GET",
      url: "/v1/api-keys",
      headers: { authorization: tenant.authHeader },
    });
    const listed = list2.json().data.find((k: { id: string }) => k.id === body.id);
    expect(listed.apiKey).toBeUndefined();
    expect(listed.prefix).toBe(body.prefix);

    const revoked = await app.inject({
      method: "POST",
      url: `/v1/api-keys/${body.id}/revoke`,
      headers: { authorization: tenant.authHeader },
    });
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json().revokedAt).toBeTruthy();

    const denied = await app.inject({
      method: "GET",
      url: "/v1/usage",
      headers: { authorization: `Bearer ${body.apiKey}` },
    });
    expect(denied.statusCode).toBe(401);
  });

  it("rejects cross-project revoke", async () => {
    const other = await createTestTenant("keys-other");
    const created = await app.inject({
      method: "POST",
      url: "/v1/api-keys",
      headers: { authorization: tenant.authHeader },
      payload: { name: "isolation" },
    });
    const id = created.json().id;
    const otherApp = await buildApp({ db: other.db, rateLimitPerMinute: 10_000 });
    await otherApp.ready();
    try {
      const res = await otherApp.inject({
        method: "POST",
        url: `/v1/api-keys/${id}/revoke`,
        headers: { authorization: other.authHeader },
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await otherApp.close();
    }
  });

  it("returns usage series for interval=day", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/usage?interval=day",
      headers: { authorization: tenant.authHeader },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("series");
    expect(body).toHaveProperty("activeAgents");
    expect(Array.isArray(body.series)).toBe(true);
  });
});
