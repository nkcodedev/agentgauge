"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RunSummary } from "@/lib/api-client";
import {
  formatAbsolute,
  formatDurationMs,
  formatNumber,
  formatRelative,
  formatRunCost,
} from "@/lib/format";
import { Card, StatusPill } from "./ui";
import { RunningDuration } from "./running-duration";

export function RunsTable({
  runs,
  nextCursor,
  range,
  filters,
}: {
  runs: RunSummary[];
  nextCursor: string | null;
  range: string;
  filters: { agentId: string; status: string };
}) {
  const router = useRouter();

  function loadMore() {
    const q = new URLSearchParams();
    if (range) q.set("range", range);
    if (filters.agentId) q.set("agentId", filters.agentId);
    if (filters.status) q.set("status", filters.status);
    if (nextCursor) q.set("cursor", nextCursor);
    router.push(`/runs?${q.toString()}`);
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-ink-200 px-4 py-3 text-sm text-ink-600">
        {runs.length} runs
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3 font-medium">Run</th>
              <th className="px-4 py-3 font-medium">Agent</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Requests</th>
              <th className="px-4 py-3 font-medium">Tokens</th>
              <th className="px-4 py-3 font-medium">Estimated cost</th>
              <th className="px-4 py-3 font-medium">Errors</th>
              <th className="px-4 py-3 font-medium">Retries</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Started</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-t border-ink-100 hover:bg-ink-50/80">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/runs/${encodeURIComponent(run.id)}`} className="no-underline">
                    <span className="text-accent">{run.name}</span>
                    <span className="mt-0.5 block font-mono text-xs font-normal text-ink-500">
                      {run.id}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/agents/${encodeURIComponent(run.agentId)}`}
                    className="no-underline"
                  >
                    {run.agentId}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={run.status} kind="run" />
                </td>
                <td className="px-4 py-3">{formatNumber(run.requestCount)}</td>
                <td className="px-4 py-3">{formatNumber(run.totalTokens)}</td>
                <td
                  className="px-4 py-3"
                  title={run.hasUnknownCost ? "Some traces lack pricing" : undefined}
                >
                  {formatRunCost(run.estimatedCost, run.hasUnknownCost)}
                </td>
                <td className="px-4 py-3">{formatNumber(run.errorCount)}</td>
                <td className="px-4 py-3">
                  {run.retryCount === 1 ? "1 retry" : `${formatNumber(run.retryCount)} retries`}
                </td>
                <td className="px-4 py-3">
                  {run.status === "running" ? (
                    <RunningDuration startedAt={run.startedAt} />
                  ) : (
                    formatDurationMs(run.durationMs)
                  )}
                </td>
                <td className="px-4 py-3" title={formatAbsolute(run.startedAt)}>
                  {formatRelative(run.startedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nextCursor ? (
        <div className="border-t border-ink-200 px-4 py-3">
          <button type="button" className="text-sm text-accent" onClick={loadMore}>
            Load more
          </button>
        </div>
      ) : null}
    </Card>
  );
}
