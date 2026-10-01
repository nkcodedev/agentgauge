import { describe, expect, it } from "vitest";
import {
  formatCost,
  formatDurationMs,
  formatNumber,
  formatRunCost,
  formatRunStatusLabel,
  rangeFromPreset,
} from "./format";

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

describe("formatDurationMs", () => {
  it("formats sub-second and longer durations", () => {
    expect(formatDurationMs(450)).toBe("450 ms");
    expect(formatDurationMs(2500)).toBe("2.50 s");
    expect(formatDurationMs(125_000)).toBe("2m 5s");
  });
});

describe("formatRunCost", () => {
  it("shows plain cost when fully known", () => {
    expect(formatRunCost(0.0412, false)).toContain("0.0412");
  });

  it("prefixes partial when some traces lack pricing", () => {
    expect(formatRunCost(0.0412, true)).toBe(`Partial: ${formatCost(0.0412)}`);
    expect(formatRunCost(0, true)).toBe("Partial: cost unavailable");
  });
});

describe("formatRunStatusLabel", () => {
  it("title-cases run statuses", () => {
    expect(formatRunStatusLabel("running")).toBe("Running");
    expect(formatRunStatusLabel("success")).toBe("Success");
    expect(formatRunStatusLabel("cancelled")).toBe("Cancelled");
    expect(formatRunStatusLabel("timeout")).toBe("Timeout");
  });
});

describe("rangeFromPreset", () => {
  it("returns ISO windows", () => {
    const r = rangeFromPreset("24h");
    expect(Date.parse(r.from)).toBeLessThan(Date.parse(r.to));
  });
});
