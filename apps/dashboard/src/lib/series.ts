import type { UsageSeriesPoint } from "./api-client";

export type SeriesMetric = "requests" | "estimatedCost" | "totalTokens" | "errors";

/** Compare the later half of an already-fetched series with the earlier half. */
export function halfDelta(series: UsageSeriesPoint[], metric: SeriesMetric): number | null {
  if (series.length < 2) return null;
  const mid = Math.floor(series.length / 2);
  const early = series.slice(0, mid).reduce((sum, point) => sum + point[metric], 0);
  const late = series.slice(mid).reduce((sum, point) => sum + point[metric], 0);
  if (early === 0) return late === 0 ? 0 : null;
  return (late - early) / early;
}

export function errorRateDelta(series: UsageSeriesPoint[]): number | null {
  if (series.length < 2) return null;
  const mid = Math.floor(series.length / 2);
  const rate = (points: UsageSeriesPoint[]) => {
    const requests = points.reduce((sum, point) => sum + point.requests, 0);
    const errors = points.reduce((sum, point) => sum + point.errors, 0);
    return requests === 0 ? 0 : errors / requests;
  };
  const early = rate(series.slice(0, mid));
  const late = rate(series.slice(mid));
  if (early === 0) return late === 0 ? 0 : null;
  return (late - early) / early;
}

export function topWithOther<T extends { key: string }>(
  rows: T[],
  value: (row: T) => number,
  limit = 5,
): T[] {
  const sorted = [...rows].sort((a, b) => value(b) - value(a));
  if (sorted.length <= limit) return sorted;
  const head = sorted.slice(0, limit);
  const rest = sorted.slice(limit);
  const other = rest.reduce(
    (acc, row) => {
      acc.requests += "requests" in row ? Number((row as { requests: number }).requests) : 0;
      acc.totalTokens +=
        "totalTokens" in row ? Number((row as { totalTokens: number }).totalTokens) : 0;
      acc.estimatedCost +=
        "estimatedCost" in row ? Number((row as { estimatedCost: number }).estimatedCost) : 0;
      acc.errors += "errors" in row ? Number((row as { errors: number }).errors) : 0;
      return acc;
    },
    {
      key: "Other",
      requests: 0,
      totalTokens: 0,
      estimatedCost: 0,
      errors: 0,
      inputTokens: 0,
      outputTokens: 0,
      averageLatencyMs: 0,
    },
  );
  return [...head, other as unknown as T];
}

export const PROVIDER_COLORS: Record<string, string> = {
  openai: "#0f766e",
  anthropic: "#b45309",
  google: "#1d4ed8",
  unknown: "#8a94a3",
};

export function providerColor(provider: string | null | undefined): string {
  if (!provider) return PROVIDER_COLORS.unknown;
  return PROVIDER_COLORS[provider.toLowerCase()] ?? PROVIDER_COLORS.unknown;
}
