import { test, expect } from "@playwright/test";

/**
 * Optional browser E2E. Requires:
 * - API on :3000
 * - dashboard on :3001 with AGENTGAUGE_API_KEY
 * - playwright browsers installed
 */
test.describe("dashboard smoke", () => {
  test("overview loads and navigates", async ({ page }) => {
    await page.goto("/overview");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await page.getByRole("link", { name: "Agents" }).first().click();
    await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();
    await page.getByRole("link", { name: "Traces" }).first().click();
    await expect(page.getByRole("heading", { name: "Traces" })).toBeVisible();
    await page.getByRole("link", { name: "Settings" }).first().click();
    await expect(page.getByRole("heading", { name: "API keys" })).toBeVisible();
  });
});
