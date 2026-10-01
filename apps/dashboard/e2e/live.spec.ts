import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

/**
 * Live update E2E: open overview, send telemetry, assert UI updates without reload.
 * Requires API :3000 + dashboard :3001 with AGENTGAUGE_API_KEY configured.
 */
test.describe("dashboard live updates", () => {
  test("overview request count updates without page.reload", async ({ page, request }) => {
    const apiKey = process.env.AGENTGAUGE_API_KEY;
    const apiUrl = process.env.AGENTGAUGE_API_URL ?? "http://127.0.0.1:3000";
    test.skip(!apiKey, "AGENTGAUGE_API_KEY required for live E2E");

    await page.goto("/overview");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByTestId("live-indicator")).toBeVisible();

    const requestsLabel = page.getByText("Requests", { exact: true }).first();
    await expect(requestsLabel).toBeVisible();
    const kpiCard = requestsLabel.locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
    const beforeText = await kpiCard.locator(".text-2xl").innerText();
    const before = Number(beforeText.replace(/,/g, ""));
    expect(Number.isFinite(before)).toBe(true);

    const eventId = randomUUID();
    const started = new Date().toISOString();
    const res = await request.post(`${apiUrl}/v1/traces`, {
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      data: {
        events: [
          {
            eventId,
            traceId: eventId,
            agentId: "playwright-live-agent",
            provider: "openai",
            model: "gpt-4o-mini",
            operationName: "playwright-live",
            startedAt: started,
            endedAt: started,
            latencyMs: 12,
            status: "success",
            usage: { inputTokens: 40, outputTokens: 10, totalTokens: 50 },
            sdk: { name: "@agentgauge/node", version: "0.5.0" },
          },
        ],
      },
    });
    expect(res.status()).toBe(202);

    await expect
      .poll(
        async () => {
          const text = await kpiCard.locator(".text-2xl").innerText();
          return Number(text.replace(/,/g, ""));
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(before);

    await expect(page.getByTestId("live-indicator")).toHaveAttribute("data-status", "live", {
      timeout: 10_000,
    });

    await page.getByRole("link", { name: "Agents" }).first().click();
    await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();
    await expect(page.getByText("playwright-live-agent")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("link", { name: "Traces" }).first().click();
    await expect(page.getByRole("heading", { name: "Traces" })).toBeVisible();
    await expect(page.getByText("playwright-live-agent").first()).toBeVisible({ timeout: 15_000 });
  });
});
