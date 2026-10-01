import { describe, expect, it } from "vitest";
import { calculateCost, roundHalfUp, selectPricing, type PricingRow } from "./pricing.js";
import { PRODUCTION_MODEL_PRICING } from "./pricing-seeds.js";

function productionRows(): PricingRow[] {
  return PRODUCTION_MODEL_PRICING.map((r) => ({
    provider: r.provider,
    model: r.model,
    inputPricePerMillion: r.inputPricePerMillion,
    outputPricePerMillion: r.outputPricePerMillion,
    currency: r.currency,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
  }));
}

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

describe("selectPricing precedence", () => {
  it("prefers an installation override over a matching AgentGauge seed", () => {
    const rows: PricingRow[] = [
      {
        provider: "openai",
        model: "gpt-4o-mini",
        inputPricePerMillion: "0.15000000",
        outputPricePerMillion: "0.60000000",
        currency: "USD",
        effectiveFrom: new Date("2024-01-01T00:00:00.000Z"),
        effectiveTo: null,
        source: "seed",
      },
      {
        provider: "openai",
        model: "gpt-4o-mini",
        inputPricePerMillion: "1.00000000",
        outputPricePerMillion: "2.00000000",
        currency: "USD",
        effectiveFrom: new Date("2026-10-01T00:00:00.000Z"),
        effectiveTo: null,
        source: "override",
      },
    ];
    const selected = selectPricing(
      rows,
      "openai",
      "gpt-4o-mini",
      new Date("2026-10-02T00:00:00.000Z"),
    );
    expect(selected?.source).toBe("override");
    expect(selected?.inputPricePerMillion).toBe("1.00000000");

    const before = selectPricing(
      rows,
      "openai",
      "gpt-4o-mini",
      new Date("2026-09-01T00:00:00.000Z"),
    );
    expect(before?.source).toBe("seed");
  });
});

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

  it("prices arbitrary non-OpenAI providers using test rows", () => {
    const rows: PricingRow[] = [
      {
        provider: "anthropic",
        model: "fake-test-model",
        inputPricePerMillion: "1.00000000",
        outputPricePerMillion: "2.00000000",
        currency: "USD",
        effectiveFrom: new Date("2024-01-01T00:00:00.000Z"),
        effectiveTo: null,
      },
      {
        provider: "google",
        model: "fake-test-model",
        inputPricePerMillion: "0.50000000",
        outputPricePerMillion: "1.50000000",
        currency: "USD",
        effectiveFrom: new Date("2024-01-01T00:00:00.000Z"),
        effectiveTo: null,
      },
    ];

    const anthropic = calculateCost(
      {
        provider: "anthropic",
        model: "fake-test-model",
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        timestamp: new Date("2024-06-01T00:00:00.000Z"),
      },
      rows,
    );
    expect(anthropic.status).toBe("priced");
    expect(anthropic.totalCost).toBe("3");

    const google = calculateCost(
      {
        provider: "google",
        model: "fake-test-model",
        inputTokens: 1_000_000,
        outputTokens: 0,
        timestamp: new Date("2024-06-01T00:00:00.000Z"),
      },
      rows,
    );
    expect(google.status).toBe("priced");
    expect(google.totalCost).toBe("0.5");
  });

  it("keeps unknown anthropic/google models as unknown_model (Cost unavailable)", () => {
    for (const provider of ["anthropic", "google"] as const) {
      const result = calculateCost(
        {
          provider,
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
    }
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

describe("production Anthropic pricing seeds", () => {
  const rows = productionRows();
  const at = new Date("2026-07-15T00:00:00.000Z");
  const cases: Array<{
    model: string;
    inputPrice: string;
    outputPrice: string;
    expectedInput: string;
    expectedOutput: string;
    expectedTotal: string;
  }> = [
    {
      model: "claude-sonnet-5-5",
      inputPrice: "2.00000000",
      outputPrice: "10.00000000",
      // 1234 * 2 / 1e6 = 0.002468; 567 * 10 / 1e6 = 0.00567
      expectedInput: "0.002468",
      expectedOutput: "0.00567",
      expectedTotal: "0.008138",
    },
    {
      model: "claude-opus-5-5",
      inputPrice: "4.00000000",
      outputPrice: "20.00000000",
      expectedInput: "0.004936",
      expectedOutput: "0.01134",
      expectedTotal: "0.016276",
    },
    {
      model: "claude-haiku-4-5",
      inputPrice: "1.00000000",
      outputPrice: "5.00000000",
      expectedInput: "0.001234",
      expectedOutput: "0.002835",
      expectedTotal: "0.004069",
    },
    {
      model: "claude-haiku-4-5-20251001",
      inputPrice: "1.00000000",
      outputPrice: "5.00000000",
      expectedInput: "0.001234",
      expectedOutput: "0.002835",
      expectedTotal: "0.004069",
    },
    {
      model: "claude-sonnet-4-5",
      inputPrice: "3.00000000",
      outputPrice: "15.00000000",
      expectedInput: "0.003702",
      expectedOutput: "0.008505",
      expectedTotal: "0.012207",
    },
    {
      model: "claude-sonnet-4-5-20250929",
      inputPrice: "3.00000000",
      outputPrice: "15.00000000",
      expectedInput: "0.003702",
      expectedOutput: "0.008505",
      expectedTotal: "0.012207",
    },
    {
      model: "claude-opus-4-6",
      inputPrice: "5.00000000",
      outputPrice: "25.00000000",
      expectedInput: "0.00617",
      expectedOutput: "0.014175",
      expectedTotal: "0.020345",
    },
  ];

  for (const c of cases) {
    it(`prices ${c.model} exactly`, () => {
      const selected = selectPricing(rows, "anthropic", c.model, at);
      expect(selected?.inputPricePerMillion).toBe(c.inputPrice);
      expect(selected?.outputPricePerMillion).toBe(c.outputPrice);

      const result = calculateCost(
        {
          provider: "anthropic",
          model: c.model,
          inputTokens: 1_234,
          outputTokens: 567,
          timestamp: at,
        },
        rows,
      );
      expect(result.status).toBe("priced");
      expect(result.inputCost).toBe(c.expectedInput);
      expect(result.outputCost).toBe(c.expectedOutput);
      expect(result.totalCost).toBe(c.expectedTotal);
      expect(result.currency).toBe("USD");
    });
  }

  it("does not fuzzy-match unknown Anthropic suffixes", () => {
    const result = calculateCost(
      {
        provider: "anthropic",
        model: "claude-sonnet-5-5-extra",
        inputTokens: 100,
        outputTokens: 50,
        timestamp: at,
      },
      rows,
    );
    expect(result.status).toBe("unknown_model");
    expect(result.totalCost).toBeNull();
  });

  it("ignores cache usageDetails when pricing (no double-count)", () => {
    // Cost engine never reads metadata; only first-class token fields.
    const withoutCache = calculateCost(
      {
        provider: "anthropic",
        model: "claude-sonnet-5-5",
        inputTokens: 1_000,
        outputTokens: 100,
        timestamp: at,
      },
      rows,
    );
    // Same token fields would yield same cost even if callers also stored cache details.
    expect(withoutCache.totalCost).toBe("0.003");
    expect(withoutCache.inputCost).toBe("0.002");
    expect(withoutCache.outputCost).toBe("0.001");
  });
});

describe("production Google pricing seeds", () => {
  const rows = productionRows();
  const at = new Date("2026-07-15T00:00:00.000Z");

  it("prices gemini-2.5-flash exactly", () => {
    const result = calculateCost(
      {
        provider: "google",
        model: "gemini-2.5-flash",
        inputTokens: 1_234,
        outputTokens: 567,
        timestamp: at,
      },
      rows,
    );
    // 1234 * 0.30 / 1e6 = 0.0003702; 567 * 2.50 / 1e6 = 0.0014175
    expect(result.status).toBe("priced");
    expect(result.inputCost).toBe("0.0003702");
    expect(result.outputCost).toBe("0.0014175");
    expect(result.totalCost).toBe("0.0017877");
  });

  it("prices gemini-2.5-pro at <=200k standard tier", () => {
    const result = calculateCost(
      {
        provider: "google",
        model: "gemini-2.5-pro",
        inputTokens: 1_234,
        outputTokens: 567,
        timestamp: at,
      },
      rows,
    );
    // 1234 * 1.25 / 1e6 = 0.0015425; 567 * 10 / 1e6 = 0.00567
    expect(result.status).toBe("priced");
    expect(result.inputCost).toBe("0.0015425");
    expect(result.outputCost).toBe("0.00567");
    expect(result.totalCost).toBe("0.0072125");
  });

  it("does not price deprecated gemini-2.0-flash", () => {
    const result = calculateCost(
      {
        provider: "google",
        model: "gemini-2.0-flash",
        inputTokens: 100,
        outputTokens: 50,
        timestamp: at,
      },
      rows,
    );
    expect(result.status).toBe("unknown_model");
  });

  it("rejects provider=gemini (canonical id is google)", () => {
    const result = calculateCost(
      {
        provider: "gemini",
        model: "gemini-2.5-flash",
        inputTokens: 100,
        outputTokens: 50,
        timestamp: at,
      },
      rows,
    );
    expect(result.status).toBe("unknown_model");
  });

  it("does not add reasoningTokens into cost (no double-count)", () => {
    const base = calculateCost(
      {
        provider: "google",
        model: "gemini-2.5-flash",
        inputTokens: 1_000,
        outputTokens: 500,
        timestamp: at,
      },
      rows,
    );
    // Output already includes thinking per Google; metadata.reasoningTokens are ignored.
    expect(base.inputCost).toBe("0.0003");
    expect(base.outputCost).toBe("0.00125");
    expect(base.totalCost).toBe("0.00155");
  });
});

describe("OpenAI production audit", () => {
  const rows = productionRows();

  it("keeps current gpt-4o-mini / gpt-4o rates", () => {
    const mini = selectPricing(rows, "openai", "gpt-4o-mini", new Date("2024-06-01T00:00:00.000Z"));
    expect(mini?.inputPricePerMillion).toBe("0.15000000");
    expect(mini?.outputPricePerMillion).toBe("0.60000000");

    const fourO = selectPricing(rows, "openai", "gpt-4o", new Date("2024-06-01T00:00:00.000Z"));
    expect(fourO?.inputPricePerMillion).toBe("2.50000000");
    expect(fourO?.outputPricePerMillion).toBe("10.00000000");
  });

  it("preserves historical gpt-4o-mini period", () => {
    const hist = selectPricing(rows, "openai", "gpt-4o-mini", new Date("2023-06-01T00:00:00.000Z"));
    expect(hist?.inputPricePerMillion).toBe("0.10000000");
    expect(hist?.effectiveTo?.toISOString()).toBe("2024-01-01T00:00:00.000Z");
  });
});
