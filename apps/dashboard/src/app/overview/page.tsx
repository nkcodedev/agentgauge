import { Suspense } from "react";
import { ApiError, fetchUsage } from "@/lib/api-client";
import { hasServerApiKey } from "@/lib/env";
import {
  formatCost,
  formatLatency,
  formatNumber,
  intervalForPreset,
  rangeFromPreset,
  type RangePreset,
} from "@/lib/format";
import { BreakdownBars, TimeSeriesChart } from "@/components/charts";
import { MobileNav, RangeFilter } from "@/components/range-filter";
import { EmptyState, ErrorBanner, KpiCard, PageHeader, Skeleton } from "@/components/ui";

export const dynamic = "force-dynamic";

function Onboarding() {
  return (
    <EmptyState title="No telemetry yet">
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          Install the SDK:{" "}
          <code className="rounded bg-ink-100 px-1 font-mono text-xs">
            npm install @agentgauge/node
          </code>
        </li>
        <li>
          Create or copy an API key from <a href="/settings/api-keys">Settings → API keys</a>.
        </li>
        <li>Configure the SDK:</li>
      </ol>
      <pre className="overflow-x-auto rounded-md bg-ink-950 p-3 font-mono text-xs text-ink-50">{`const gauge = new AgentGauge({
  apiKey: process.env.AGENTGAUGE_API_KEY,
  endpoint: "http://localhost:3000",
});`}</pre>
      <p>Send a first trace, then refresh this page. Agents appear automatically.</p>
    </EmptyState>
  );
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

    if (usage.requests === 0) {
      return <Onboarding />;
    }

    return (
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard label="Requests" value={formatNumber(usage.requests)} />
          <KpiCard label="Total tokens" value={formatNumber(usage.totalTokens)} />
          <KpiCard label="Estimated cost" value={formatCost(usage.estimatedCost)} />
          <KpiCard label="Average latency" value={formatLatency(usage.averageLatencyMs)} />
          <KpiCard label="Errors" value={formatNumber(usage.errors)} />
          <KpiCard label="Active agents" value={formatNumber(usage.activeAgents)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <TimeSeriesChart series={usage.series} metric="requests" />
          <TimeSeriesChart series={usage.series} metric="estimatedCost" />
          <TimeSeriesChart series={usage.series} metric="totalTokens" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <BreakdownBars title="Cost by agent" rows={usage.byAgent} />
          <BreakdownBars title="Usage by model" rows={usage.byModel} valueKey="requests" />
          <BreakdownBars title="Usage by provider" rows={usage.byProvider} valueKey="requests" />
        </div>
      </div>
    );
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.status === 401
          ? "Invalid or missing project API key."
          : error.message
        : "API unavailable. Is the AgentGauge API running on port 3000?";
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
      <MobileNav />
      <PageHeader
        title="Overview"
        description="Usage, cost, and reliability for your AgentGauge project."
        actions={
          <Suspense fallback={<Skeleton className="h-9 w-40" />}>
            <RangeFilter defaultPreset={range} />
          </Suspense>
        }
      />
      <Suspense
        fallback={
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
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
