"use client";

import { useState } from "react";
import Link from "next/link";
import type { TraceListItem } from "@/lib/api-client";
import { formatAbsolute, formatCost, formatLatency, formatNumber } from "@/lib/format";
import { providerColor } from "@/lib/series";
import { Card, Drawer, StatusPill } from "./ui";

function label(trace: TraceListItem): string {
  return trace.operationId ?? trace.operationName ?? "request";
}

export function RunWaterfall({ traces }: { traces: TraceListItem[] }) {
  const [selected, setSelected] = useState<TraceListItem | null>(null);
  const max = Math.max(...traces.map((trace) => trace.latencyMs), 1);
  const groups = new Map<string, TraceListItem[]>();
  for (const trace of traces) {
    const key = trace.operationId ?? trace.eventId;
    const list = groups.get(key) ?? [];
    list.push(trace);
    groups.set(key, list);
  }

  if (traces.length === 0) return null;

  return (
    <>
      <Card className="p-4">
        <h3 className="text-sm font-medium text-fg">Timeline</h3>
        <p className="mt-1 text-2xs text-faint">
          Bar length is latency. Failed attempts stay visible.
        </p>
        <div className="mt-4 space-y-4">
          {[...groups.entries()].map(([key, attempts]) => (
            <div key={key}>
              <div className="mb-1 text-sm text-fg">{label(attempts[0]!)}</div>
              <div className="space-y-1">
                {attempts.map((trace) => (
                  <button
                    key={trace.eventId}
                    type="button"
                    className="flex w-full items-center gap-3 text-left"
                    onClick={() => setSelected(trace)}
                  >
                    <span className="w-16 shrink-0 text-2xs text-secondary">
                      {trace.attempt ? `Attempt ${trace.attempt}` : "Attempt"}
                    </span>
                    <span className="h-3 flex-1 rounded-full bg-muted">
                      <span
                        className="block h-3 rounded-full"
                        style={{
                          width: `${Math.max(4, (trace.latencyMs / max) * 100)}%`,
                          background:
                            trace.status === "error"
                              ? "var(--danger)"
                              : providerColor(trace.provider),
                        }}
                      />
                    </span>
                    <StatusPill status={trace.status} />
                    <span className="w-16 text-right text-2xs text-secondary">
                      {formatLatency(trace.latencyMs)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Drawer title="Trace" open={selected !== null} onClose={() => setSelected(null)}>
        {selected ? (
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-2xs text-faint">Operation</dt>
              <dd>{label(selected)}</dd>
            </div>
            <div>
              <dt className="text-2xs text-faint">Status</dt>
              <dd>
                <StatusPill status={selected.status} />
              </dd>
            </div>
            <div>
              <dt className="text-2xs text-faint">Provider / model</dt>
              <dd>
                {selected.provider ?? "—"} ·{" "}
                <span className="font-mono text-2xs">{selected.model ?? "—"}</span>
              </dd>
            </div>
            <div>
              <dt className="text-2xs text-faint">Tokens</dt>
              <dd>{formatNumber(selected.totalTokens ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-2xs text-faint">Cost</dt>
              <dd className="font-mono text-2xs">
                {selected.totalCost === null || selected.costStatus === "unknown_model"
                  ? "Cost unavailable"
                  : formatCost(selected.totalCost, { currency: selected.currency })}
              </dd>
            </div>
            <div>
              <dt className="text-2xs text-faint">Started</dt>
              <dd>{formatAbsolute(selected.startedAt)}</dd>
            </div>
            <Link
              href={`/traces?eventId=${encodeURIComponent(selected.eventId)}&range=30d`}
              className="text-sm"
            >
              Open in traces
            </Link>
          </dl>
        ) : null}
      </Drawer>
    </>
  );
}
