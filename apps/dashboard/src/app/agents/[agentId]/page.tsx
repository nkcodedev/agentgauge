import Link from "next/link";
import { ApiError, fetchAgent, fetchTraces, fetchUsage } from "@/lib/api-client";
import { hasServerApiKey } from "@/lib/env";
import {
  formatAbsolute,
  formatCost,
  formatLatency,
  formatNumber,
  formatRelative,
  rangeFromPreset,
} from "@/lib/format";
import { BreakdownBars, TimeSeriesChart } from "@/components/charts";
import { Card, ErrorBanner, KpiCard, PageHeader, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const decoded = decodeURIComponent(agentId);

  return (
    <div>
      <PageHeader
        title={decoded}
        description="Usage summary for a single auto-discovered agent."
        actions={
          <Link
            href={`/traces?agentId=${encodeURIComponent(decoded)}`}
            className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 no-underline"
          >
            View traces
          </Link>
        }
      />
      <AgentBody agentId={decoded} />
    </div>
  );
}

async function AgentBody({ agentId }: { agentId: string }) {
  if (!hasServerApiKey()) {
    return <ErrorBanner message="Set AGENTGAUGE_API_KEY to load agent details." />;
  }

  try {
    const window = rangeFromPreset("30d");
    const [agent, usage, traces] = await Promise.all([
      fetchAgent(agentId),
      fetchUsage({ ...window, interval: "day" }),
      fetchTraces({ agentId, limit: 10 }),
    ]);

    const agentUsage = usage.byAgent.find((a) => a.key === agentId);
    const agentSeries = usage.series; // project-level trend; filtered cost by agent shown in KPIs

    return (
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            label="Requests"
            value={formatNumber(agent.requestCount)}
            hint={`First seen ${formatRelative(agent.firstSeen)}`}
          />
          <KpiCard label="Tokens" value={formatNumber(agent.totalTokens)} />
          <KpiCard label="Estimated cost" value={formatCost(agent.estimatedCost)} />
          <KpiCard label="Errors" value={formatNumber(agent.errorCount)} />
          <KpiCard label="Average latency" value={formatLatency(agent.averageLatencyMs)} />
          <KpiCard
            label="Last seen"
            value={formatRelative(agent.lastSeen)}
            hint={formatAbsolute(agent.lastSeen)}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <TimeSeriesChart series={agentSeries} metric="estimatedCost" />
          <BreakdownBars title="Model usage (project)" rows={usage.byModel} valueKey="requests" />
        </div>
        <BreakdownBars
          title="Provider usage (project)"
          rows={usage.byProvider}
          valueKey="requests"
        />

        <Card className="overflow-hidden p-0">
          <div className="border-b border-ink-200 px-4 py-3 text-sm font-medium">
            Recent traces
            {agentUsage ? (
              <span className="ml-2 font-normal text-ink-500">
                ({formatNumber(agentUsage.requests)} in last 30d)
              </span>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-ink-50 text-xs uppercase text-ink-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Model</th>
                  <th className="px-4 py-2 font-medium">Tokens</th>
                  <th className="px-4 py-2 font-medium">Latency</th>
                  <th className="px-4 py-2 font-medium">Cost</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {traces.data.map((t) => (
                  <tr key={t.eventId} className="border-t border-ink-100">
                    <td className="px-4 py-2" title={formatAbsolute(t.startedAt)}>
                      <Link
                        href={`/traces?eventId=${encodeURIComponent(t.eventId)}`}
                        className="no-underline"
                      >
                        {formatRelative(t.startedAt)}
                      </Link>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{t.model ?? "—"}</td>
                    <td className="px-4 py-2">{formatNumber(t.totalTokens ?? 0)}</td>
                    <td className="px-4 py-2">{formatLatency(t.latencyMs)}</td>
                    <td className="px-4 py-2">
                      {t.totalCost === null || t.costStatus === "unknown_model"
                        ? "Cost unavailable"
                        : formatCost(t.totalCost, { currency: t.currency })}
                    </td>
                    <td className="px-4 py-2">
                      <StatusPill status={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return <ErrorBanner message={`Agent "${agentId}" was not found in this project.`} />;
    }
    return (
      <ErrorBanner
        message={error instanceof ApiError ? error.message : "Failed to load agent details."}
      />
    );
  }
}
