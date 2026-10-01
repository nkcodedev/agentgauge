import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { createTestTenant, type TestTenant } from "./test/helpers.js";

describe("model pricing API", () => {
  let app: FastifyInstance;
  let tenant: TestTenant;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    tenant = await createTestTenant("pricing-api");
    app = await buildApp({ db: tenant.db, rateLimitPerMinute: 10_000 });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("requires an API key", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/model-pricing" });
    expect(res.statusCode).toBe(401);
  });

  it("lists seeded pricing and filters by provider and model search", async () => {
    const list = await app.inject({
      method: "GET",
      url: "/v1/model-pricing?provider=openai&q=gpt-4o-mini&status=active&source=agentgauge_default",
      headers: { authorization: tenant.authHeader },
    });
    expect(list.statusCode).toBe(200);
    const data = list.json().data as Array<{ provider: string; model: string; kind: string }>;
    expect(data.length).toBeGreaterThan(0);
    expect(
      data.every((row) => row.provider === "openai" && row.model.includes("gpt-4o-mini")),
    ).toBe(true);
    expect(data.every((row) => row.kind === "agentgauge_default")).toBe(true);
  });

  it("creates a custom model and rejects a bad price", async () => {
    const model = `api-custom-${randomUUID().slice(0, 8)}`;
    const created = await app.inject({
      method: "POST",
      url: "/v1/model-pricing",
      headers: { authorization: tenant.authHeader },
      payload: {
        provider: "acme",
        model,
        inputPricePerMillion: "0.5",
        outputPricePerMillion: "1.5",
        effectiveFrom: "2093-01-01T00:00:00.000Z",
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().kind).toBe("custom");

    const bad = await app.inject({
      method: "POST",
      url: "/v1/model-pricing",
      headers: { authorization: tenant.authHeader },
      payload: {
        provider: "acme",
        model: `bad-${randomUUID().slice(0, 8)}`,
        inputPricePerMillion: "-2",
        outputPricePerMillion: "1",
        effectiveFrom: "2093-01-01T00:00:00.000Z",
      },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.message).toMatch(/non-negative/);
  });

  it("supersedes user pricing without removing the previous row", async () => {
    const model = `api-super-${randomUUID().slice(0, 8)}`;
    const created = await app.inject({
      method: "POST",
      url: "/v1/model-pricing",
      headers: { authorization: tenant.authHeader },
      payload: {
        provider: "acme",
        model,
        inputPricePerMillion: "1",
        outputPricePerMillion: "2",
        effectiveFrom: "2094-01-01T00:00:00.000Z",
      },
    });
    const id = created.json().id as string;
    const updated = await app.inject({
      method: "POST",
      url: `/v1/model-pricing/${id}/supersede`,
      headers: { authorization: tenant.authHeader },
      payload: {
        inputPricePerMillion: "3",
        outputPricePerMillion: "4",
        effectiveFrom: "2094-04-01T00:00:00.000Z",
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().closed.effectiveTo).toBe("2094-04-01T00:00:00.000Z");
    expect(updated.json().closed.inputPricePerMillion).toContain("1");

    const history = await app.inject({
      method: "GET",
      url: `/v1/model-pricing?provider=acme&model=${encodeURIComponent(model)}`,
      headers: { authorization: tenant.authHeader },
    });
    expect(history.json().data).toHaveLength(2);
  });
});
