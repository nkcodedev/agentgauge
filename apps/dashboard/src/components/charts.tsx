"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { UsageBreakdownRow, UsageSeriesPoint } from "@/lib/api-client";
import { formatAbsolute, formatCost, formatNumber } from "@/lib/format";
import { Card } from "./ui";

export function TimeSeriesChart({
  series,
  metric,
}: {
  series: UsageSeriesPoint[];
  metric: "requests" | "estimatedCost" | "totalTokens";
}) {
  const data = series.map((p) => ({
    ...p,
    label: formatAbsolute(p.bucket),
  }));
  const label = metric === "requests" ? "Requests" : metric === "estimatedCost" ? "Cost" : "Tokens";

  return (
    <Card>
      <div className="mb-3 text-sm font-medium text-ink-800">{label} over time</div>
      {data.length === 0 ? (
        <div className="flex h-56 items-center justify-center text-sm text-ink-500">No data</div>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d5dae3" />
              <XAxis dataKey="label" hide />
              <YAxis width={48} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number) =>
                  metric === "estimatedCost" ? formatCost(value) : formatNumber(value)
                }
              />
              <Line type="monotone" dataKey={metric} stroke="#0f766e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export function BreakdownBars({
  title,
  rows,
  valueKey = "estimatedCost",
}: {
  title: string;
  rows: UsageBreakdownRow[];
  valueKey?: "estimatedCost" | "requests" | "totalTokens";
}) {
  const data = rows.slice(0, 8).map((r) => ({
    name: r.key,
    value: r[valueKey],
  }));

  return (
    <Card>
      <div className="mb-3 text-sm font-medium text-ink-800">{title}</div>
      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-ink-500">No data</div>
      ) : (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d5dae3" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number) =>
                  valueKey === "estimatedCost" ? formatCost(value) : formatNumber(value)
                }
              />
              <Bar dataKey="value" fill="#0d9488" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
