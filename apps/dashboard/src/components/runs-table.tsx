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
import { Card, dataCellClass, dataHeadClass, dataTableClass, StatusPill } from "./ui";
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
      <div className="table-scroll">
        <table className={dataTableClass}>
          <thead className={dataHeadClass}>
            <tr>
              {[
                "Run",
                "Agent",
                "Status",
                "Requests",
                "Tokens",
                "Estimated cost",
                "Errors",
                "Retries",
                "Duration",
                "Started",
              ].map((label) => (
                <th key={label} className={`${dataCellClass} font-medium`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-t border-ink-100 hover:bg-ink-50/80">
                <td className={`${dataCellClass} font-medium`}>
                  <Link href={`/runs/${encodeURIComponent(run.id)}`} className="no-underline">
                    <span className="text-accent">{run.name}</span>
                    <span className="mt-0.5 block font-mono text-xs font-normal text-faint">
                      {run.id}
                    </span>
                  </Link>
                </td>
                <td className={dataCellClass}>
                  <Link
                    href={`/agents/${encodeURIComponent(run.agentId)}`}
                    className="no-underline"
                  >
                    {run.agentId}
                  </Link>
                </td>
                <td className={dataCellClass}>
                  <StatusPill status={run.status} kind="run" />
                </td>
                <td className={dataCellClass}>{formatNumber(run.requestCount)}</td>
                <td className={dataCellClass}>{formatNumber(run.totalTokens)}</td>
                <td
                  className={`${dataCellClass} font-mono text-xs`}
                  title={run.hasUnknownCost ? "Some traces lack pricing" : undefined}
                >
                  {formatRunCost(run.estimatedCost, run.hasUnknownCost)}
                </td>
                <td className={dataCellClass}>{formatNumber(run.errorCount)}</td>
                <td className={dataCellClass}>
                  {run.retryCount === 1 ? "1 retry" : `${formatNumber(run.retryCount)} retries`}
                </td>
                <td className={dataCellClass}>
                  {run.status === "running" ? (
                    <RunningDuration startedAt={run.startedAt} />
                  ) : (
                    formatDurationMs(run.durationMs)
                  )}
                </td>
                <td className={dataCellClass} title={formatAbsolute(run.startedAt)}>
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
