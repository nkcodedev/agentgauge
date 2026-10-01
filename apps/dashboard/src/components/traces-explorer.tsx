"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TraceDetail, TraceListItem } from "@/lib/api-client";
import {
  formatAbsolute,
  formatCost,
  formatLatency,
  formatNumber,
  formatRelative,
} from "@/lib/format";
import { Card, StatusPill } from "./ui";

export function TracesExplorer({
  traces,
  nextCursor,
  selected,
  filters,
}: {
  traces: TraceListItem[];
  nextCursor: string | null;
  selected: TraceDetail | null;
  filters: {
    agentId: string;
    provider: string;
    model: string;
    status: string;
    range: string;
  };
}) {
  const router = useRouter();

  function pushFilters(next: Partial<typeof filters> & { cursor?: string; eventId?: string }) {
    const q = new URLSearchParams();
    const merged = { ...filters, ...next };
    if (merged.range) q.set("range", merged.range);
    if (merged.agentId) q.set("agentId", merged.agentId);
    if (merged.provider) q.set("provider", merged.provider);
    if (merged.model) q.set("model", merged.model);
    if (merged.status) q.set("status", merged.status);
    if (next.cursor) q.set("cursor", next.cursor);
    if (next.eventId) q.set("eventId", next.eventId);
    router.push(`/traces?${q.toString()}`);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        <Card>
          <form
            className="grid gap-3 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              pushFilters({
                agentId: String(fd.get("agentId") ?? ""),
                provider: String(fd.get("provider") ?? ""),
                model: String(fd.get("model") ?? ""),
                status: String(fd.get("status") ?? ""),
              });
            }}
          >
            <label className="text-xs text-ink-600">
              Agent
              <input
                name="agentId"
                defaultValue={filters.agentId}
                className="mt-1 w-full rounded border border-ink-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-ink-600">
              Provider
              <input
                name="provider"
                defaultValue={filters.provider}
                className="mt-1 w-full rounded border border-ink-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-ink-600">
              Model
              <input
                name="model"
                defaultValue={filters.model}
                className="mt-1 w-full rounded border border-ink-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-ink-600">
              Status
              <select
                name="status"
                defaultValue={filters.status}
                className="mt-1 w-full rounded border border-ink-200 px-2 py-1.5 text-sm"
              >
                <option value="">Any</option>
                <option value="success">success</option>
                <option value="error">error</option>
              </select>
            </label>
            <div className="sm:col-span-4">
              <button type="submit" className="rounded-md bg-ink-900 px-3 py-2 text-sm text-white">
                Apply filters
              </button>
            </div>
          </form>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-ink-50 text-xs uppercase text-ink-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Provider</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Operation</th>
                  <th className="px-4 py-3 font-medium">Tokens</th>
                  <th className="px-4 py-3 font-medium">Latency</th>
                  <th className="px-4 py-3 font-medium">Cost</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {traces.map((t) => (
                  <tr
                    key={t.eventId}
                    className={`border-t border-ink-100 hover:bg-ink-50/80 ${
                      selected?.eventId === t.eventId ? "bg-accent-soft/40" : ""
                    }`}
                  >
                    <td className="px-4 py-3" title={formatAbsolute(t.startedAt)}>
                      <button
                        type="button"
                        className="text-left text-accent"
                        onClick={() => pushFilters({ eventId: t.eventId })}
                      >
                        {formatRelative(t.startedAt)}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/agents/${encodeURIComponent(t.agentId)}`}
                        className="no-underline"
                      >
                        {t.agentId}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{t.provider ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{t.model ?? "—"}</td>
                    <td className="px-4 py-3">{t.operationName ?? "—"}</td>
                    <td className="px-4 py-3">{formatNumber(t.totalTokens ?? 0)}</td>
                    <td className="px-4 py-3">{formatLatency(t.latencyMs)}</td>
                    <td className="px-4 py-3">
                      {t.totalCost === null || t.costStatus === "unknown_model"
                        ? "Cost unavailable"
                        : formatCost(t.totalCost, { currency: t.currency })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nextCursor ? (
            <div className="border-t border-ink-200 px-4 py-3">
              <button
                type="button"
                className="text-sm text-accent"
                onClick={() => pushFilters({ cursor: nextCursor })}
              >
                Load more
              </button>
            </div>
          ) : null}
        </Card>
      </div>

      <aside>
        <Card>
          <h2 className="text-sm font-semibold text-ink-900">Trace details</h2>
          {!selected ? (
            <p className="mt-2 text-sm text-ink-600">Select a trace to inspect metadata.</p>
          ) : (
            <dl className="mt-3 space-y-2 text-sm">
              {[
                ["eventId", selected.eventId],
                ["traceId", selected.traceId],
                ["agent", selected.agentId],
                ["provider", selected.provider ?? "—"],
                ["model", selected.model ?? "—"],
                ["operation", selected.operationName ?? "—"],
                ["startedAt", formatAbsolute(selected.startedAt)],
                ["endedAt", formatAbsolute(selected.endedAt)],
                ["latency", formatLatency(selected.latencyMs)],
                ["status", selected.status],
                [
                  "tokens",
                  `${selected.inputTokens ?? 0} / ${selected.outputTokens ?? 0} / ${selected.totalTokens ?? 0}`,
                ],
                [
                  "cost",
                  selected.totalCost === null || selected.costStatus === "unknown_model"
                    ? "Cost unavailable"
                    : formatCost(selected.totalCost, { currency: selected.currency }),
                ],
                ["sdk", `${selected.sdkName}@${selected.sdkVersion}`],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[110px_1fr] gap-2">
                  <dt className="text-ink-500">{k}</dt>
                  <dd className="break-all font-mono text-xs text-ink-900">{v}</dd>
                </div>
              ))}
              {selected.errorMessage ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-2 text-red-800">
                  <div className="font-medium">{selected.errorName ?? "Error"}</div>
                  <div className="mt-1 text-xs">{selected.errorMessage}</div>
                  {selected.errorCode ? (
                    <div className="mt-1 font-mono text-xs">code: {selected.errorCode}</div>
                  ) : null}
                </div>
              ) : null}
              {selected.tags && selected.tags.length > 0 ? (
                <div>
                  <div className="text-ink-500">tags</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selected.tags.map((tag) => (
                      <span key={tag} className="rounded bg-ink-100 px-2 py-0.5 font-mono text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {selected.metadata ? (
                <div>
                  <div className="text-ink-500">metadata</div>
                  <pre className="mt-1 max-h-48 overflow-auto rounded bg-ink-50 p-2 font-mono text-xs">
                    {JSON.stringify(selected.metadata, null, 2)}
                  </pre>
                </div>
              ) : null}
            </dl>
          )}
        </Card>
      </aside>
    </div>
  );
}
