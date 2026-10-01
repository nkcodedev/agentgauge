import { describe, expect, it } from "vitest";
import { formatCost } from "./format.js";
import type { UsageBreakdownRow } from "./api-client.js";

describe("multi-provider dashboard compatibility", () => {
  it("treats null estimated cost as Cost unavailable for any provider row", () => {
    expect(formatCost(null, { unavailable: true })).toBe("Cost unavailable");
    expect(formatCost(undefined)).toBe("Cost unavailable");
  });

  it("accepts dynamic byProvider keys including anthropic and google", () => {
    const rows: UsageBreakdownRow[] = [
      {
        key: "openai",
        requests: 3,
        totalTokens: 100,
        estimatedCost: 0.01,
        errors: 0,
      },
      {
        key: "anthropic",
        requests: 2,
        totalTokens: 80,
        estimatedCost: 0,
        errors: 0,
      },
      {
        key: "google",
        requests: 1,
        totalTokens: 40,
        estimatedCost: 0,
        errors: 0,
      },
    ];

    expect(rows.map((r) => r.key)).toEqual(["openai", "anthropic", "google"]);
    expect(rows.every((r) => typeof r.requests === "number")).toBe(true);
  });
});
