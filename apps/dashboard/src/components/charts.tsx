"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { UsageBreakdownRow, UsageSeriesPoint } from "@/lib/api-client";
import { formatAbsolute, formatCost, formatNumber } from "@/lib/format";
import { providerColor, topWithOther } from "@/lib/series";
import { ChartCard } from "./ui";

const SYNC = "usage";

const axisTickStyle = { fontSize: 12, fill: "var(--text-secondary)" };

const tooltipStyle = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
  },
  labelStyle: { color: "var(--text)", fontWeight: 600 },
  itemStyle: { color: "var(--text-secondary)" },
};

function axisTick(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

export function UsageCharts({ series }: { series: UsageSeriesPoint[] }) {
  const mid = Math.floor(series.length / 2);
  const earlier = series.slice(0, mid);
  const data = series.map((point, index) => ({
    ...point,
    label: formatAbsolute(point.bucket),
    priorRequests: earlier[index - mid]?.requests ?? null,
    priorCost: earlier[index - mid]?.estimatedCost ?? null,
    priorTokens: earlier[index - mid]?.totalTokens ?? null,
  }));

  if (data.length === 0) {
    return <ChartCard title="Usage over time">No data in this range.</ChartCard>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ChartCard title="Requests">
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} syncId={SYNC}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="bucket"
                tickFormatter={axisTick}
                tick={axisTickStyle}
                stroke="var(--text-muted)"
              />
              <YAxis
                width={40}
                domain={[0, "auto"]}
                tick={axisTickStyle}
                stroke="var(--text-muted)"
              />
              <Tooltip
                {...tooltipStyle}
                labelFormatter={(value) => formatAbsolute(String(value))}
                formatter={(value: number, name: string) => [
                  formatNumber(Number(value)),
                  name === "priorRequests" ? "Earlier in range" : "Requests",
                ]}
              />
              <Bar dataKey="requests" radius={[4, 4, 0, 0]}>
                {data.map((point) => (
                  <Cell
                    key={point.bucket}
                    fill={point.errors > 0 ? "var(--danger)" : "var(--accent)"}
                  />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="priorRequests"
                stroke="var(--text-muted)"
                strokeDasharray="4 4"
                dot={false}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
      <MetricLine title="Cost" data={data} metric="estimatedCost" prior="priorCost" money />
      <MetricLine title="Tokens" data={data} metric="totalTokens" prior="priorTokens" />
    </div>
  );
}

function MetricLine({
  title,
  data,
  metric,
  prior,
  money,
}: {
  title: string;
  data: Array<UsageSeriesPoint & { label: string }>;
  metric: "estimatedCost" | "totalTokens";
  prior: string;
  money?: boolean;
}) {
  const format = (value: number) => (money ? formatCost(value) : formatNumber(value));
  return (
    <ChartCard title={title}>
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} syncId={SYNC}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="bucket"
              tickFormatter={axisTick}
              tick={axisTickStyle}
              stroke="var(--text-muted)"
            />
            <YAxis
              width={48}
              domain={[0, "auto"]}
              tick={axisTickStyle}
              stroke="var(--text-muted)"
            />
            <Tooltip
              {...tooltipStyle}
              labelFormatter={(value) => formatAbsolute(String(value))}
              formatter={(value: number, name: string) => [
                format(Number(value)),
                name === prior ? "Earlier in range" : title,
              ]}
            />
            <Line
              type="monotone"
              dataKey={metric}
              stroke="var(--accent)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey={prior}
              stroke="var(--text-muted)"
              strokeDasharray="4 4"
              dot={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function TimeSeriesChart({
  series,
  metric,
}: {
  series: UsageSeriesPoint[];
  metric: "requests" | "estimatedCost" | "totalTokens";
}) {
  if (metric === "requests") return <UsageCharts series={series} />;
  return (
    <MetricLine
      title={metric === "estimatedCost" ? "Cost" : "Tokens"}
      data={series.map((point) => ({ ...point, label: formatAbsolute(point.bucket) }))}
      metric={metric}
      prior={metric === "estimatedCost" ? "priorCost" : "priorTokens"}
      money={metric === "estimatedCost"}
    />
  );
}

export function BreakdownBars({
  title,
  rows,
  valueKey = "estimatedCost",
  colorByProvider = false,
}: {
  title: string;
  rows: UsageBreakdownRow[];
  valueKey?: "estimatedCost" | "requests" | "totalTokens";
  colorByProvider?: boolean;
}) {
  const limited = topWithOther(rows, (row) => row[valueKey]);
  const total = limited.reduce((sum, row) => sum + row[valueKey], 0) || 1;
  const max = Math.max(...limited.map((row) => row[valueKey]), 1);

  return (
    <ChartCard title={title}>
      {limited.length === 0 ? (
        <div className="flex h-40 items-center text-sm text-secondary">No data</div>
      ) : (
        <ul className="space-y-3">
          {limited.map((row) => {
            const value = row[valueKey];
            const share = Math.round((value / total) * 100);
            const width = `${Math.max(2, (value / max) * 100)}%`;
            const color = colorByProvider ? providerColor(row.key) : "var(--accent)";
            const label = valueKey === "estimatedCost" ? formatCost(value) : formatNumber(value);
            return (
              <li key={row.key}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-fg" title={row.key}>
                    {row.key}
                  </span>
                  <span className="shrink-0 font-mono text-2xs text-secondary">
                    {label} · {share}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div className="h-1.5 rounded-full" style={{ width, background: color }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ChartCard>
  );
}
