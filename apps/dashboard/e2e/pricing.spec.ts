import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test.describe("model pricing", () => {
  test("adds a custom price, prices a trace, and keeps history after an update", async ({
    page,
    request,
  }) => {
    const apiKey = process.env.AGENTGAUGE_API_KEY;
    const apiUrl = process.env.AGENTGAUGE_API_URL ?? "http://127.0.0.1:3000";
    test.skip(!apiKey, "AGENTGAUGE_API_KEY required for pricing E2E");

    const model = `pw-price-${randomUUID().slice(0, 8)}`;
    await page.goto("/settings/model-pricing");
    await expect(page.getByRole("heading", { name: "Model pricing" })).toBeVisible();

    await page.getByRole("button", { name: "Add model pricing" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Add model pricing" });
    await dialog.getByLabel("Provider").fill("acme");
    await dialog.getByLabel("Model").fill(model);
    await dialog.getByLabel("Input price / 1M").fill("2");
    await dialog.getByLabel("Output price / 1M").fill("4");
    await dialog.getByLabel("Effective from").fill("2026-01-01T00:00");
    await dialog.getByRole("button", { name: "Add pricing" }).click();
    await expect(page.getByText("Pricing added")).toBeVisible();
    const pricingRow = page.getByRole("row", { name: new RegExp(model) });
    await expect(pricingRow).toBeVisible();

    const firstEvent = randomUUID();
    const first = await request.post(`${apiUrl}/v1/traces`, {
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      data: {
        events: [
          {
            eventId: firstEvent,
            traceId: firstEvent,
            agentId: "playwright-pricing-agent",
            provider: "acme",
            model,
            startedAt: "2026-08-01T00:00:00.000Z",
            endedAt: "2026-08-01T00:00:01.000Z",
            latencyMs: 1000,
            status: "success",
            usage: { inputTokens: 1_000_000, outputTokens: 0, totalTokens: 1_000_000 },
            sdk: { name: "@agentgauge/node", version: "0.5.0" },
          },
        ],
      },
    });
    expect(first.status()).toBe(202);
    const firstTrace = await request.get(`${apiUrl}/v1/traces/${firstEvent}`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    expect(firstTrace.ok()).toBeTruthy();
    const firstBody = (await firstTrace.json()) as { totalCost: string | null };
    expect(Number(firstBody.totalCost)).toBeCloseTo(2, 6);

    await pricingRow.getByRole("button", { name: "Update pricing" }).click();
    const update = page.getByRole("dialog", { name: "Update pricing" });
    await update.getByLabel("Input price / 1M").fill("5");
    await update.getByLabel("Output price / 1M").fill("6");
    await update.getByLabel("Effective from").fill("2026-09-01T00:00");
    await update.getByRole("button", { name: "Update pricing" }).click();
    await expect(page.getByText("Pricing updated")).toBeVisible();

    await page
      .getByRole("row", { name: new RegExp(model) })
      .filter({ hasText: "Active" })
      .getByRole("button", { name: "History" })
      .click();
    const history = page.getByRole("dialog", { name: "Pricing history" });
    await expect(history).toBeVisible();
    await expect(history.getByText("Historical")).toBeVisible();

    const secondEvent = randomUUID();
    const second = await request.post(`${apiUrl}/v1/traces`, {
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      data: {
        events: [
          {
            eventId: secondEvent,
            traceId: secondEvent,
            agentId: "playwright-pricing-agent",
            provider: "acme",
            model,
            startedAt: "2026-09-02T00:00:00.000Z",
            endedAt: "2026-09-02T00:00:01.000Z",
            latencyMs: 1000,
            status: "success",
            usage: { inputTokens: 1_000_000, outputTokens: 0, totalTokens: 1_000_000 },
            sdk: { name: "@agentgauge/node", version: "0.5.0" },
          },
        ],
      },
    });
    expect(second.status()).toBe(202);
    const secondTrace = await request.get(`${apiUrl}/v1/traces/${secondEvent}`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    expect(secondTrace.ok()).toBeTruthy();
    const secondBody = (await secondTrace.json()) as { totalCost: string | null };
    expect(Number(secondBody.totalCost)).toBeCloseTo(5, 6);
  });
});
