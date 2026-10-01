import { describe, expect, it } from "vitest";
import {
  isSeededModel,
  ModelPricingError,
  parsePrice,
  pricingWindowStatus,
  windowsOverlap,
} from "./model-pricing-catalog.js";

describe("model pricing validation", () => {
  it("accepts a non-negative decimal and rejects bad prices", () => {
    expect(parsePrice("0.1500", "Input price")).toBe("0.1500");
    expect(parsePrice("0", "Input price")).toBe("0");
    for (const bad of ["-1", "NaN", "Infinity", "1e2", "", "1.123456789"]) {
      expect(() => parsePrice(bad, "Input price")).toThrow(ModelPricingError);
    }
  });

  it("classifies windows and overlap", () => {
    const now = new Date("2026-10-01T00:00:00.000Z");
    expect(pricingWindowStatus(new Date("2026-01-01T00:00:00.000Z"), null, now)).toBe("active");
    expect(pricingWindowStatus(new Date("2026-11-01T00:00:00.000Z"), null, now)).toBe("upcoming");
    expect(
      pricingWindowStatus(
        new Date("2025-01-01T00:00:00.000Z"),
        new Date("2026-01-01T00:00:00.000Z"),
        now,
      ),
    ).toBe("historical");
    expect(
      windowsOverlap(
        new Date("2026-01-01T00:00:00.000Z"),
        new Date("2026-06-01T00:00:00.000Z"),
        new Date("2026-06-01T00:00:00.000Z"),
        null,
      ),
    ).toBe(false);
    expect(
      windowsOverlap(
        new Date("2026-01-01T00:00:00.000Z"),
        null,
        new Date("2026-06-01T00:00:00.000Z"),
        null,
      ),
    ).toBe(true);
  });

  it("recognizes seeded models by exact provider and model", () => {
    expect(isSeededModel("openai", "gpt-4o-mini")).toBe(true);
    expect(isSeededModel("openai", "gpt-4o-mini-custom")).toBe(false);
    expect(isSeededModel("acme", "widget")).toBe(false);
  });
});
