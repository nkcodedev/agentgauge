import Link from "next/link";
import { Suspense } from "react";
import { ApiError, fetchUsage, type UsageResponse } from "@/lib/api-client";
import { hasServerApiKey } from "@/lib/env";
import {
  formatCost,
  formatLatency,
  formatNumber,
  intervalForPreset,
  rangeFromPreset,
  type RangePreset,
} from "@/lib/format";
import { errorRateDelta, halfDelta } from "@/lib/series";
import { BreakdownBars, UsageCharts } from "@/components/charts";
import { Card, EmptyState, ErrorBanner, KpiCard, PageHeader, Skeleton } from "@/components/ui";

export const dynamic = "force-dynamic";

function Onboarding() {
  return (
    <EmptyState title="No telemetry yet">
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          Install the SDK:{" "}
          <code className="rounded bg-muted px-1 text-2xs">npm install @agentgauge/node</code>
        </li>
        <li>
          Create or copy an API key from <a href="/settings/api-keys">Settings → API keys</a>.
        </li>
        <li>
          Docs:{" "}
          <a href="https://github.com/nkcodedev/agentgauge/blob/main/docs/TELEMETRY.md">
            telemetry guide
          </a>
        </li>
      </ol>
      <pre className="overflow-x-auto rounded-control bg-fg p-3 text-2xs text-surface">{`const gauge = new AgentGauge({
  apiKey: process.env.AGENTGAUGE_API_KEY,
  endpoint: "http://localhost:3000",
});`}</pre>
      <p>Send a first trace. Agents appear automatically.</p>
    </EmptyState>
  );
}

function healthLine(usage: UsageResponse, range: RangePreset): string {
  const rate = usage.requests === 0 ? 0 : (usage.errors / usage.requests) * 100;
  const costDelta = halfDelta(usage.series, "estimatedCost");
  const delta =
    costDelta === null
      ? ""
      : `, ${costDelta >= 0 ? "+" : ""}${(costDelta * 100).toFixed(0)}% vs earlier in range`;
  return `${formatNumber(usage.activeAgents)} active agents · ${formatNumber(usage.errors)} errors (${rate.toFixed(1)}%) · ${formatCost(usage.estimatedCost)} this ${range === "24h" ? "day" : "range"}${delta}`;
}

async function OverviewBody({ range }: { range: RangePreset }) {
  if (!hasServerApiKey()) {
    return (
      <ErrorBanner message="Set AGENTGAUGE_API_KEY in apps/dashboard/.env.local (server-side only) to connect the dashboard." />
    );
  }

  try {
    const window = rangeFromPreset(range);
    const usage = await fetchUsage({
      ...window,
      interval: intervalForPreset(range),
    });

    if (usage.requests === 0) return <Onboarding />;

    const errorRate = usage.requests === 0 ? 0 : usage.errors / usage.requests;
    const attention = [...usage.byAgent].filter((row) => row.requests > 0);
    const highestErrors = [...attention].sort(
      (a, b) => b.errors / b.requests - a.errors / a.requests,
    )[0];
    const slowest = [...attention].sort((a, b) => b.averageLatencyMs - a.averageLatencyMs)[0];
    const costliest = [...attention].sort((a, b) => b.estimatedCost - a.estimatedCost)[0];

    return (
      <div className="space-y-4">
        <p className="text-sm text-secondary">{healthLine(usage, range)}</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            label="Requests"
            value={formatNumber(usage.requests)}
            delta={
              halfDelta(usage.series, "requests") === null
                ? null
                : { value: halfDelta(usage.series, "requests")! }
            }
            sparkline={usage.series.map((point) => point.requests)}
          />
          <KpiCard
            label="Tokens"
            value={formatNumber(usage.totalTokens)}
            delta={
              halfDelta(usage.series, "totalTokens") === null
                ? null
                : { value: halfDelta(usage.series, "totalTokens")! }
            }
            sparkline={usage.series.map((point) => point.totalTokens)}
          />
          <KpiCard
            label="Cost"
            value={formatCost(usage.estimatedCost)}
            delta={
              halfDelta(usage.series, "estimatedCost") === null
                ? null
                : { value: halfDelta(usage.series, "estimatedCost")! }
            }
            sparkline={usage.series.map((point) => point.estimatedCost)}
          />
          <KpiCard
            label="Avg latency"
            value={formatLatency(usage.averageLatencyMs)}
            hint="Average. Percentiles are not stored."
          />
          <KpiCard
            label="Error rate"
            value={`${(errorRate * 100).toFixed(1)}%`}
            delta={
              errorRateDelta(usage.series) === null
                ? null
                : { value: errorRateDelta(usage.series)! }
            }
            sparkline={usage.series.map((point) =>
              point.requests ? point.errors / point.requests : 0,
            )}
          />
        </div>

        <UsageCharts series={usage.series} />

        <div className="grid gap-4 lg:grid-cols-3">
          <BreakdownBars title="Cost by agent" rows={usage.byAgent} />
          <BreakdownBars title="Usage by model" rows={usage.byModel} valueKey="requests" />
          <BreakdownBars
            title="Usage by provider"
            rows={usage.byProvider}
            valueKey="requests"
            colorByProvider
          />
        </div>

        <Card className="p-4">
          <h2 className="text-sm font-medium text-fg">Needs attention</h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-3">
            {highestErrors ? (
              <li className="text-sm">
                <div className="text-2xs text-faint">Highest error rate</div>
                <Link
                  href={`/traces?agentId=${encodeURIComponent(highestErrors.key)}&status=error&range=${range}`}
                >
                  {highestErrors.key}
                </Link>
                <div className="text-2xs text-secondary">
                  {((highestErrors.errors / highestErrors.requests) * 100).toFixed(1)}% errors
                </div>
              </li>
            ) : null}
            {slowest ? (
              <li className="text-sm">
                <div className="text-2xs text-faint">Slowest average</div>
                <Link href={`/agents/${encodeURIComponent(slowest.key)}`}>{slowest.key}</Link>
                <div className="text-2xs text-secondary">
                  {formatLatency(slowest.averageLatencyMs)} avg
                </div>
              </li>
            ) : null}
            {costliest ? (
              <li className="text-sm">
                <div className="text-2xs text-faint">Highest cost</div>
                <Link href={`/agents/${encodeURIComponent(costliest.key)}`}>{costliest.key}</Link>
                <div className="font-mono text-2xs text-secondary">
                  {formatCost(costliest.estimatedCost)}
                </div>
              </li>
            ) : null}
          </ul>
        </Card>
      </div>
    );
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.status === 401
          ? "The project API key was rejected. Check AGENTGAUGE_API_KEY and refresh."
          : `${error.message} Refresh to retry.`
        : "The AgentGauge API did not respond. Confirm it is running on port 3000, then refresh.";
    return <ErrorBanner message={message} />;
  }
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = (
    ["24h", "7d", "30d"].includes(params.range ?? "") ? params.range : "7d"
  ) as RangePreset;

  return (
    <div>
      <PageHeader title="Overview" description="Usage, cost, and reliability for this project." />
      <Suspense
        fallback={
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        }
      >
        <OverviewBody range={range} />
      </Suspense>
    </div>
  );
}
