import { describe, expect, it } from "vitest";
import { formatCost, formatNumber, rangeFromPreset } from "./format";

describe("formatCost", () => {
  it("formats small costs with extra precision", () => {
    expect(formatCost(0.00045)).toContain("0.000450");
  });

  it("shows unavailable instead of $0 for unknown pricing", () => {
    expect(formatCost(null, { unavailable: true })).toBe("Cost unavailable");
    expect(formatCost(undefined)).toBe("Cost unavailable");
  });

  it("formats zero distinctly from unavailable", () => {
    expect(formatCost(0)).toMatch(/\$0/);
  });
});

describe("formatNumber", () => {
  it("formats integers", () => {
    expect(formatNumber(1500)).toBe("1,500");
  });
});

describe("rangeFromPreset", () => {
  it("returns ISO windows", () => {
    const r = rangeFromPreset("24h");
    expect(Date.parse(r.from)).toBeLessThan(Date.parse(r.to));
  });
});
