"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AgentSummary } from "@/lib/api-client";
import {
  formatAbsolute,
  formatCost,
  formatLatency,
  formatNumber,
  formatRelative,
} from "@/lib/format";
import { Card } from "./ui";

const sortOptions = [
  { id: "lastSeen", label: "Last seen" },
  { id: "requests", label: "Requests" },
  { id: "tokens", label: "Tokens" },
  { id: "cost", label: "Cost" },
  { id: "errors", label: "Error rate" },
  { id: "latency", label: "Latency" },
];

function fleetStatus(agent: AgentSummary): "healthy" | "degraded" | "idle" {
  if (agent.requestCount === 0) return "idle";
  const rate = agent.errorCount / agent.requestCount;
  if (rate >= 0.05) return "degraded";
  return "healthy";
}

const dotClass = {
  healthy: "bg-ok",
  degraded: "bg-warn",
  idle: "bg-faint",
};

export function AgentsTable({ agents, sort }: { agents: AgentSummary[]; sort: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter((agent) => {
      if (!showInactive && agent.requestCount === 0) return false;
      if (q && !agent.agentId.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [agents, query, showInactive]);

  function setSort(id: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("sort", id);
    router.push(`/agents?${params.toString()}`);
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search agents"
          aria-label="Search agents"
          className="w-56 rounded-control border border-line bg-surface px-2 py-1.5 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
        <label className="ml-auto flex items-center gap-2 text-sm text-secondary">
          Sort
          <select
            className="rounded-control border border-line bg-surface px-2 py-1"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort agents"
          >
            {sortOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="table-scroll">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface text-2xs text-secondary">
            <tr>
              {["Agent", "Requests", "Tokens", "Cost", "Error rate", "Latency", "Last seen"].map(
                (label) => (
                  <th key={label} className="px-4 py-2 font-medium">
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((agent) => {
              const status = fleetStatus(agent);
              const rate = agent.requestCount === 0 ? 0 : agent.errorCount / agent.requestCount;
              return (
                <tr key={agent.agentId} className="border-t border-line hover:bg-muted/70">
                  <td className="px-4 py-2">
                    <Link
                      href={`/agents/${encodeURIComponent(agent.agentId)}`}
                      className="inline-flex items-center gap-2 font-medium no-underline"
                    >
                      <span className={`h-2 w-2 rounded-full ${dotClass[status]}`} title={status} />
                      {agent.agentId}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{formatNumber(agent.requestCount)}</td>
                  <td className="px-4 py-2">{formatNumber(agent.totalTokens)}</td>
                  <td className="px-4 py-2 font-mono text-2xs">
                    {formatCost(agent.estimatedCost)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-2xs ${
                        rate >= 0.05 ? "bg-bad-soft text-bad" : "bg-ok-soft text-ok"
                      }`}
                    >
                      {(rate * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-2" title="Average latency. Percentiles are not stored.">
                    {formatLatency(agent.averageLatencyMs)}
                  </td>
                  <td className="px-4 py-2" title={formatAbsolute(agent.lastSeen)}>
                    {formatRelative(agent.lastSeen)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
