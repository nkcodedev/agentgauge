export type RangePreset = "24h" | "7d" | "30d";

export function rangeFromPreset(preset: RangePreset): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  if (preset === "24h") from.setUTCHours(from.getUTCHours() - 24);
  if (preset === "7d") from.setUTCDate(from.getUTCDate() - 7);
  if (preset === "30d") from.setUTCDate(from.getUTCDate() - 30);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function intervalForPreset(preset: RangePreset): "hour" | "day" {
  return preset === "24h" ? "hour" : "day";
}

export function formatCost(
  value: number | string | null | undefined,
  options?: { unavailable?: boolean; currency?: string | null },
): string {
  if (options?.unavailable || value === null || value === undefined) {
    return "Cost unavailable";
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "Cost unavailable";
  const currency = options?.currency ?? "USD";
  const abs = Math.abs(n);
  const fractionDigits = abs > 0 && abs < 0.01 ? 6 : abs < 1 ? 4 : 2;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(n);
  } catch {
    return `$${n.toFixed(fractionDigits)}`;
  }
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

export function formatRelative(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  const deltaSec = Math.round((then - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const abs = Math.abs(deltaSec);
  if (abs < 60) return rtf.format(deltaSec, "second");
  const mins = Math.round(deltaSec / 60);
  if (Math.abs(mins) < 60) return rtf.format(mins, "minute");
  const hours = Math.round(deltaSec / 3600);
  if (Math.abs(hours) < 48) return rtf.format(hours, "hour");
  const days = Math.round(deltaSec / 86400);
  return rtf.format(days, "day");
}
