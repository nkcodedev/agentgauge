import { describe, expect, it } from "vitest";
import { calculateCost, roundHalfUp, selectPricing, type PricingRow } from "./pricing.js";

const baseRows: PricingRow[] = [
  {
    provider: "openai",
    model: "gpt-4o-mini",
    inputPricePerMillion: "0.15000000",
    outputPricePerMillion: "0.60000000",
    currency: "USD",
    effectiveFrom: new Date("2024-01-01T00:00:00.000Z"),
    effectiveTo: null,
  },
  {
    provider: "openai",
    model: "gpt-4o-mini",
    inputPricePerMillion: "0.10000000",
    outputPricePerMillion: "0.40000000",
    currency: "USD",
    effectiveFrom: new Date("2023-01-01T00:00:00.000Z"),
    effectiveTo: new Date("2024-01-01T00:00:00.000Z"),
  },
];

describe("calculateCost", () => {
  it("prices a known model with both input and output tokens", () => {
    const result = calculateCost(
      {
        provider: "openai",
        model: "gpt-4o-mini",
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        timestamp: new Date("2024-06-01T00:00:00.000Z"),
      },
      baseRows,
    );
    expect(result.status).toBe("priced");
    expect(result.inputCost).toBe("0.15");
    expect(result.outputCost).toBe("0.6");
    expect(result.totalCost).toBe("0.75");
    expect(result.currency).toBe("USD");
  });

  it("returns unknown_model without fabricating cost", () => {
    const result = calculateCost(
      {
        provider: "openai",
        model: "totally-unknown-model",
        inputTokens: 100,
        outputTokens: 50,
        timestamp: new Date("2024-06-01T00:00:00.000Z"),
      },
      baseRows,
    );
    expect(result.status).toBe("unknown_model");
    expect(result.totalCost).toBeNull();
    expect(result.inputCost).toBeNull();
    expect(result.outputCost).toBeNull();
  });

  it("handles zero tokens", () => {
    const result = calculateCost(
      {
        provider: "openai",
        model: "gpt-4o-mini",
        inputTokens: 0,
        outputTokens: 0,
        timestamp: new Date("2024-06-01T00:00:00.000Z"),
      },
      baseRows,
    );
    expect(result.status).toBe("priced");
    expect(result.totalCost).toBe("0");
  });

  it("handles input-only usage", () => {
    const result = calculateCost(
      {
        provider: "openai",
        model: "gpt-4o-mini",
        inputTokens: 2_000_000,
        timestamp: new Date("2024-06-01T00:00:00.000Z"),
      },
      baseRows,
    );
    expect(result.inputCost).toBe("0.3");
    expect(result.outputCost).toBe("0");
    expect(result.totalCost).toBe("0.3");
  });

  it("handles output-only usage", () => {
    const result = calculateCost(
      {
        provider: "openai",
        model: "gpt-4o-mini",
        outputTokens: 500_000,
        timestamp: new Date("2024-06-01T00:00:00.000Z"),
      },
      baseRows,
    );
    expect(result.inputCost).toBe("0");
    expect(result.outputCost).toBe("0.3");
    expect(result.totalCost).toBe("0.3");
  });

  it("uses historical pricing by effective date", () => {
    const historical = calculateCost(
      {
        provider: "openai",
        model: "gpt-4o-mini",
        inputTokens: 1_000_000,
        outputTokens: 0,
        timestamp: new Date("2023-06-01T00:00:00.000Z"),
      },
      baseRows,
    );
    expect(historical.inputCost).toBe("0.1");

    const current = calculateCost(
      {
        provider: "openai",
        model: "gpt-4o-mini",
        inputTokens: 1_000_000,
        outputTokens: 0,
        timestamp: new Date("2024-06-01T00:00:00.000Z"),
      },
      baseRows,
    );
    expect(current.inputCost).toBe("0.15");
  });

  it("returns no_usage when tokens omitted", () => {
    const result = calculateCost(
      {
        provider: "openai",
        model: "gpt-4o-mini",
        timestamp: new Date("2024-06-01T00:00:00.000Z"),
      },
      baseRows,
    );
    expect(result.status).toBe("no_usage");
  });

  it("selects the newest effective row still valid at timestamp", () => {
    const row = selectPricing(
      baseRows,
      "openai",
      "gpt-4o-mini",
      new Date("2024-01-01T00:00:00.000Z"),
    );
    expect(row?.inputPricePerMillion).toBe("0.15000000");
  });
});

describe("roundHalfUp", () => {
  it("rounds half up", () => {
    expect(roundHalfUp("1.23455", 4)).toBe("1.2346");
    expect(roundHalfUp("1.23454", 4)).toBe("1.2345");
  });

  it("preserves decimal precision for tiny costs", () => {
    const result = calculateCost(
      {
        provider: "openai",
        model: "gpt-4o-mini",
        inputTokens: 1,
        outputTokens: 1,
        timestamp: new Date("2024-06-01T00:00:00.000Z"),
      },
      baseRows,
    );
    // 0.15/1e6 + 0.6/1e6 = 0.00000075
    expect(result.totalCost).toBe("0.00000075");
  });
});
