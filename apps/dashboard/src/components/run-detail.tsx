import Link from "next/link";
import type { RunDetail, TraceListItem } from "@/lib/api-client";
import {
  formatAbsolute,
  formatCost,
  formatDurationMs,
  formatLatency,
  formatNumber,
  formatRelative,
  formatRunCost,
} from "@/lib/format";
import { Card, dataCellClass, dataHeadClass, dataTableClass, KpiCard, StatusPill } from "./ui";
import { RunningDuration } from "./running-duration";
import { RunWaterfall } from "./run-waterfall";

function sortTraces(traces: TraceListItem[]): TraceListItem[] {
  return [...traces].sort((a, b) => {
    const opA = a.operationId ?? "";
    const opB = b.operationId ?? "";
    if (opA !== opB) return opA.localeCompare(opB);
    const attA = a.attempt ?? 0;
    const attB = b.attempt ?? 0;
    if (attA !== attB) return attA - attB;
    return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
  });
}

function operationLabel(t: TraceListItem): string {
  if (t.operationName) return t.operationName;
  if (t.operationId) return t.operationId;
  return "—";
}

export function RunDetailView({ run }: { run: RunDetail }) {
  const traces = sortTraces(run.traces ?? []);
  let lastOp: string | null = null;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-ink-950">{run.name}</h2>
              <StatusPill status={run.status} kind="run" />
            </div>
            <p className="mt-1 font-mono text-xs text-ink-500">{run.id}</p>
            <p className="mt-2 text-sm text-ink-600">
              Agent{" "}
              <Link href={`/agents/${encodeURIComponent(run.agentId)}`} className="text-accent">
                {run.agentId}
              </Link>
            </p>
          </div>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-500">Started</dt>
              <dd>{formatAbsolute(run.startedAt)}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Ended</dt>
              <dd>{run.endedAt ? formatAbsolute(run.endedAt) : "—"}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Duration</dt>
              <dd>
                {run.status === "running" ? (
                  <RunningDuration startedAt={run.startedAt} />
                ) : (
                  formatDurationMs(run.durationMs)
                )}
              </dd>
            </div>
            <div>
              <dt className="text-ink-500">Estimated cost</dt>
              <dd>{formatRunCost(run.estimatedCost, run.hasUnknownCost)}</dd>
            </div>
          </dl>
        </div>
      </Card>

      <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Requests" value={formatNumber(run.requestCount)} />
        <KpiCard label="Tokens" value={formatNumber(run.totalTokens)} />
        <KpiCard label="Errors" value={formatNumber(run.errorCount)} />
        <KpiCard
          label="Retries"
          value={formatNumber(run.retryCount)}
          hint={
            run.retryCount === 0
              ? undefined
              : run.retryCount === 1
                ? "1 retry"
                : `${formatNumber(run.retryCount)} retries`
          }
        />
      </div>

      <RunWaterfall traces={traces} />

      <Card className="overflow-hidden p-0">
        <div className="border-b border-ink-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-ink-900">Traces in this run</h3>
          <p className="mt-0.5 text-xs text-ink-500">
            Sorted by operation, then attempt. Failed attempts remain visible.
          </p>
        </div>
        {traces.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-600">No traces attached to this run yet.</p>
        ) : (
          <div className="table-scroll">
            <table className={dataTableClass}>
              <thead className={dataHeadClass}>
                <tr>
                  {[
                    "Time",
                    "Operation",
                    "Provider",
                    "Model",
                    "Status",
                    "Attempt",
                    "Tokens",
                    "Cost",
                    "Latency",
                  ].map((label) => (
                    <th key={label} className={`${dataCellClass} font-medium`}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {traces.map((t) => {
                  const opKey = t.operationId ?? t.eventId;
                  const groupBreak = lastOp !== null && lastOp !== opKey;
                  lastOp = opKey;
                  return (
                    <tr
                      key={t.eventId}
                      className={`border-t border-line hover:bg-muted/70 ${
                        groupBreak ? "border-t-line" : ""
                      } ${t.status === "error" ? "bg-bad-soft/40" : ""}`}
                    >
                      <td className={dataCellClass} title={formatAbsolute(t.startedAt)}>
                        {formatRelative(t.startedAt)}
                      </td>
                      <td className={dataCellClass}>
                        <Link
                          href={`/traces?eventId=${encodeURIComponent(t.eventId)}&range=30d`}
                          className="text-accent no-underline"
                        >
                          {operationLabel(t)}
                        </Link>
                        {t.operationId && t.operationName ? (
                          <span className="mt-0.5 block font-mono text-xs text-ink-500">
                            {t.operationId}
                          </span>
                        ) : null}
                      </td>
                      <td className={dataCellClass}>{t.provider ?? "—"}</td>
                      <td className={`${dataCellClass} font-mono text-xs`}>{t.model ?? "—"}</td>
                      <td className={dataCellClass}>
                        <StatusPill status={t.status} />
                      </td>
                      <td className={dataCellClass}>{t.attempt ?? "—"}</td>
                      <td className={dataCellClass}>{formatNumber(t.totalTokens ?? 0)}</td>
                      <td className={`${dataCellClass} font-mono text-xs`}>
                        {t.totalCost === null || t.costStatus === "unknown_model"
                          ? "Cost unavailable"
                          : formatCost(t.totalCost, { currency: t.currency })}
                      </td>
                      <td className={dataCellClass}>{formatLatency(t.latencyMs)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {run.metadata && Object.keys(run.metadata).length > 0 ? (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-fg">Metadata</h3>
          <pre className="mt-2 max-h-48 overflow-auto rounded-control bg-muted p-2 font-mono text-xs">
            {JSON.stringify(run.metadata, null, 2)}
          </pre>
        </Card>
      ) : null}
    </div>
  );
}
