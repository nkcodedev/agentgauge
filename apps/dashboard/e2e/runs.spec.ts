import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test.describe("runs dashboard", () => {
  test("lists run via SSE, aggregates traces, ends with visible errors", async ({
    page,
    request,
  }) => {
    const apiKey = process.env.AGENTGAUGE_API_KEY;
    const apiUrl = process.env.AGENTGAUGE_API_URL ?? "http://127.0.0.1:3000";
    test.skip(!apiKey, "AGENTGAUGE_API_KEY required for runs E2E");

    const runId = `pw-run-${randomUUID()}`;
    const runName = `Playwright run ${runId.slice(0, 8)}`;
    const agentId = "playwright-runs-agent";
    const operationId = `op-${randomUUID().slice(0, 8)}`;

    await page.goto("/runs?range=30d");
    await expect(page.getByRole("heading", { name: "Runs", exact: true })).toBeVisible();
    await expect(page.getByTestId("live-indicator")).toHaveAttribute("data-status", "live", {
      timeout: 15_000,
    });

    const createRes = await request.post(`${apiUrl}/v1/runs`, {
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      data: {
        id: runId,
        name: runName,
        agentId,
      },
    });
    expect(createRes.status()).toBe(201);

    await expect(page.getByRole("link", { name: new RegExp(runName) })).toBeVisible({
      timeout: 15_000,
    });

    const started = new Date().toISOString();
    for (const [attempt, status] of [
      [1, "error"],
      [2, "success"],
    ] as const) {
      const eventId = randomUUID();
      const traceRes = await request.post(`${apiUrl}/v1/traces`, {
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        data: {
          events: [
            {
              eventId,
              traceId: eventId,
              agentId,
              runId,
              operationId,
              attempt,
              provider: "openai",
              model: "gpt-4o-mini",
              operationName: "playwright-run-op",
              startedAt: started,
              endedAt: started,
              latencyMs: 20 + attempt,
              status,
              usage: { inputTokens: 30, outputTokens: 10, totalTokens: 40 },
              sdk: { name: "@agentgauge/node", version: "0.7.0" },
              ...(status === "error"
                ? {
                    error: { name: "ProviderError", message: "simulated failure" },
                  }
                : {}),
            },
          ],
        },
      });
      expect(traceRes.status()).toBe(202);
    }

    await page.getByRole("link", { name: new RegExp(runName) }).click();
    await expect(page.getByRole("heading", { name: "Run detail" })).toBeVisible();

    await expect
      .poll(async () =>
        page
          .getByText("Requests", { exact: true })
          .first()
          .locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]")
          .locator(".text-2xl")
          .innerText(),
      )
      .toBe("2");

    const errorsKpi = page
      .getByText("Errors", { exact: true })
      .first()
      .locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
    await expect
      .poll(async () => errorsKpi.locator(".text-2xl").innerText(), { timeout: 15_000 })
      .toBe("1");

    const retriesKpi = page
      .getByText("Retries", { exact: true })
      .first()
      .locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
    await expect
      .poll(async () => retriesKpi.locator(".text-2xl").innerText(), { timeout: 15_000 })
      .toBe("1");

    const endRes = await request.post(`${apiUrl}/v1/runs/${encodeURIComponent(runId)}/end`, {
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      data: { status: "success" },
    });
    expect(endRes.status()).toBe(200);

    await expect(page.getByText("Success", { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("error", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  });
});
