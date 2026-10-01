"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TraceDetail, TraceListItem } from "@/lib/api-client";
import {
  formatAbsolute,
  formatCost,
  formatLatency,
  formatNumber,
  formatRelative,
} from "@/lib/format";
import { providerColor } from "@/lib/series";
import { Card, Drawer, PrivacyBadge, StatusPill } from "./ui";

const columns = [
  "time",
  "agent",
  "provider",
  "model",
  "operation",
  "tokens",
  "latency",
  "cost",
  "status",
] as const;
type ColumnId = (typeof columns)[number];

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
  const searchRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);
  const [hidden, setHidden] = useState<ColumnId[]>([]);
  const [columnsOpen, setColumnsOpen] = useState(false);

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

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          target.tagName === "TEXTAREA");
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing) return;
      if (event.key === "j") setActive((index) => Math.min(traces.length - 1, index + 1));
      if (event.key === "k") setActive((index) => Math.max(0, index - 1));
      if (event.key === "Enter" && traces[active]) pushFilters({ eventId: traces[active].eventId });
      if (event.key === "Escape") pushFilters({});
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const visible = (id: ColumnId) => !hidden.includes(id);

  return (
    <div className="space-y-3">
      <Card className="p-4">
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
          <label className="text-2xs text-secondary">
            Agent
            <input
              ref={searchRef}
              name="agentId"
              defaultValue={filters.agentId}
              className="mt-1 w-full rounded-control border border-line bg-surface px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-2xs text-secondary">
            Provider
            <input
              name="provider"
              defaultValue={filters.provider}
              className="mt-1 w-full rounded-control border border-line bg-surface px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-2xs text-secondary">
            Model
            <input
              name="model"
              defaultValue={filters.model}
              className="mt-1 w-full rounded-control border border-line bg-surface px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-2xs text-secondary">
            Status
            <select
              name="status"
              defaultValue={filters.status}
              className="mt-1 w-full rounded-control border border-line bg-surface px-2 py-1.5 text-sm"
            >
              <option value="">Any</option>
              <option value="success">success</option>
              <option value="error">error</option>
            </select>
          </label>
          <div className="flex items-center gap-3 sm:col-span-4">
            <button type="submit" className="rounded-control bg-fg px-3 py-2 text-sm text-surface">
              Apply filters
            </button>
            <div className="relative">
              <button
                type="button"
                className="text-sm text-secondary"
                onClick={() => setColumnsOpen((open) => !open)}
              >
                Columns
              </button>
              {columnsOpen ? (
                <div className="absolute z-10 mt-1 w-40 rounded-control border border-line bg-surface p-2 shadow-overlay">
                  {columns.map((column) => (
                    <label
                      key={column}
                      className="flex items-center gap-2 py-1 text-2xs capitalize"
                    >
                      <input
                        type="checkbox"
                        checked={visible(column)}
                        onChange={() =>
                          setHidden((current) =>
                            current.includes(column)
                              ? current.filter((id) => id !== column)
                              : [...current, column],
                          )
                        }
                      />
                      {column}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
            <span className="text-2xs text-faint">
              j/k move · Enter open · Esc close · / search
            </span>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="table-scroll">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface text-2xs text-secondary">
              <tr>
                {visible("time") ? <th className="px-3 py-2 font-medium">Time</th> : null}
                {visible("agent") ? <th className="px-3 py-2 font-medium">Agent</th> : null}
                {visible("provider") ? <th className="px-3 py-2 font-medium">Provider</th> : null}
                {visible("model") ? <th className="px-3 py-2 font-medium">Model</th> : null}
                {visible("operation") ? <th className="px-3 py-2 font-medium">Operation</th> : null}
                {visible("tokens") ? <th className="px-3 py-2 font-medium">Tokens</th> : null}
                {visible("latency") ? <th className="px-3 py-2 font-medium">Latency</th> : null}
                {visible("cost") ? <th className="px-3 py-2 font-medium">Cost</th> : null}
                {visible("status") ? <th className="px-3 py-2 font-medium">Status</th> : null}
              </tr>
            </thead>
            <tbody>
              {traces.map((trace, index) => (
                <tr
                  key={trace.eventId}
                  className={`h-9 border-t border-line hover:bg-muted/70 ${
                    selected?.eventId === trace.eventId || index === active
                      ? "bg-accent-soft/40"
                      : ""
                  }`}
                >
                  {visible("time") ? (
                    <td className="px-3" title={formatAbsolute(trace.startedAt)}>
                      <button
                        type="button"
                        className="text-accent"
                        onClick={() => pushFilters({ eventId: trace.eventId })}
                      >
                        {formatRelative(trace.startedAt)}
                      </button>
                    </td>
                  ) : null}
                  {visible("agent") ? (
                    <td className="px-3">
                      <Link
                        href={`/agents/${encodeURIComponent(trace.agentId)}`}
                        className="no-underline"
                      >
                        {trace.agentId}
                      </Link>
                    </td>
                  ) : null}
                  {visible("provider") ? (
                    <td className="px-3">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: providerColor(trace.provider) }}
                        />
                        {trace.provider ?? "—"}
                      </span>
                    </td>
                  ) : null}
                  {visible("model") ? (
                    <td className="px-3 font-mono text-2xs">{trace.model ?? "—"}</td>
                  ) : null}
                  {visible("operation") ? (
                    <td className="px-3">{trace.operationName ?? "—"}</td>
                  ) : null}
                  {visible("tokens") ? (
                    <td className="px-3">{formatNumber(trace.totalTokens ?? 0)}</td>
                  ) : null}
                  {visible("latency") ? (
                    <td className="px-3">{formatLatency(trace.latencyMs)}</td>
                  ) : null}
                  {visible("cost") ? (
                    <td className="px-3 font-mono text-2xs">
                      {trace.totalCost === null || trace.costStatus === "unknown_model"
                        ? "Cost unavailable"
                        : formatCost(trace.totalCost, { currency: trace.currency })}
                    </td>
                  ) : null}
                  {visible("status") ? (
                    <td className="px-3">
                      <StatusPill status={trace.status} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {nextCursor ? (
          <div className="border-t border-line px-4 py-3">
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

      <Drawer title="Trace" open={selected !== null} onClose={() => pushFilters({})}>
        {selected ? <TraceFacts trace={selected} /> : null}
      </Drawer>
    </div>
  );
}

function TraceFacts({ trace }: { trace: TraceDetail }) {
  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
  }
  const cost =
    trace.totalCost === null || trace.costStatus === "unknown_model"
      ? "Cost unavailable"
      : formatCost(trace.totalCost, { currency: trace.currency });

  return (
    <div className="space-y-3 text-sm">
      <PrivacyBadge />
      <Fact label="Event ID" value={trace.eventId} mono onCopy={() => copy(trace.eventId)} />
      <Fact label="Trace ID" value={trace.traceId} mono onCopy={() => copy(trace.traceId)} />
      <div>
        <div className="text-2xs text-faint">Agent</div>
        <Link href={`/agents/${encodeURIComponent(trace.agentId)}`}>{trace.agentId}</Link>
      </div>
      {trace.runId ? (
        <div>
          <div className="text-2xs text-faint">Run</div>
          <Link href={`/runs/${encodeURIComponent(trace.runId)}`}>{trace.runId}</Link>
        </div>
      ) : null}
      <div>
        <div className="text-2xs text-faint">Provider / model</div>
        <div>
          {trace.provider ?? "—"} · <span className="font-mono text-2xs">{trace.model ?? "—"}</span>
        </div>
      </div>
      <div>
        <div className="text-2xs text-faint">Tokens</div>
        <div>
          {formatNumber(trace.inputTokens ?? 0)} in · {formatNumber(trace.outputTokens ?? 0)} out ·{" "}
          {formatNumber(trace.totalTokens ?? 0)} total
        </div>
      </div>
      <div>
        <div className="text-2xs text-faint">Cost</div>
        <div className="font-mono text-2xs">{cost}</div>
      </div>
      <div>
        <div className="text-2xs text-faint">Latency</div>
        <div>{formatLatency(trace.latencyMs)}</div>
      </div>
      <div>
        <div className="text-2xs text-faint">Attempt</div>
        <div>{trace.attempt ?? "—"}</div>
      </div>
      <StatusPill status={trace.status} />
      {trace.errorMessage ? (
        <div className="rounded-control border border-bad/30 bg-bad-soft p-2 text-bad">
          <div className="font-medium">{trace.errorName ?? "Error"}</div>
          <div className="mt-1 text-2xs">{trace.errorMessage}</div>
        </div>
      ) : null}
      {trace.metadata ? (
        <pre className="max-h-64 overflow-auto rounded-control bg-muted p-2 text-2xs">
          {JSON.stringify(trace.metadata, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

function Fact({
  label,
  value,
  mono,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div>
      <div className="text-2xs text-faint">{label}</div>
      <div className="flex items-start gap-2">
        <span className={`break-all ${mono ? "font-mono text-2xs" : ""}`}>{value}</span>
        {onCopy ? (
          <button type="button" className="shrink-0 text-2xs text-accent" onClick={onCopy}>
            Copy
          </button>
        ) : null}
      </div>
    </div>
  );
}
