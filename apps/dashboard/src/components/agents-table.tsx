"use client";

import Link from "next/link";
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
  { id: "cost", label: "Cost" },
  { id: "errors", label: "Errors" },
];

export function AgentsTable({ agents, sort }: { agents: AgentSummary[]; sort: string }) {
  const router = useRouter();

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
        <div className="text-sm text-ink-600">{agents.length} agents</div>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          Sort by
          <select
            className="rounded border border-ink-200 bg-white px-2 py-1"
            value={sort}
            onChange={(e) => router.push(`/agents?sort=${e.target.value}`)}
            aria-label="Sort agents"
          >
            {sortOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3 font-medium">Agent</th>
              <th className="px-4 py-3 font-medium">Requests</th>
              <th className="px-4 py-3 font-medium">Tokens</th>
              <th className="px-4 py-3 font-medium">Estimated cost</th>
              <th className="px-4 py-3 font-medium">Errors</th>
              <th className="px-4 py-3 font-medium">Avg latency</th>
              <th className="px-4 py-3 font-medium">First seen</th>
              <th className="px-4 py-3 font-medium">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.agentId} className="border-t border-ink-100 hover:bg-ink-50/80">
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/agents/${encodeURIComponent(agent.agentId)}`}
                    className="no-underline"
                  >
                    {agent.agentId}
                  </Link>
                </td>
                <td className="px-4 py-3">{formatNumber(agent.requestCount)}</td>
                <td className="px-4 py-3">{formatNumber(agent.totalTokens)}</td>
                <td className="px-4 py-3">{formatCost(agent.estimatedCost)}</td>
                <td className="px-4 py-3">{formatNumber(agent.errorCount)}</td>
                <td className="px-4 py-3">{formatLatency(agent.averageLatencyMs)}</td>
                <td className="px-4 py-3" title={formatAbsolute(agent.firstSeen)}>
                  {formatRelative(agent.firstSeen)}
                </td>
                <td className="px-4 py-3" title={formatAbsolute(agent.lastSeen)}>
                  {formatRelative(agent.lastSeen)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
