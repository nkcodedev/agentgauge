import Link from "next/link";
import { ApiError, fetchAgents, type AgentSummary } from "@/lib/api-client";
import { hasServerApiKey } from "@/lib/env";
import { EmptyState, ErrorBanner, PageHeader } from "@/components/ui";
import { AgentsTable } from "@/components/agents-table";

export const dynamic = "force-dynamic";

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const params = await searchParams;
  const sort = params.sort ?? "lastSeen";

  return (
    <div>
      <PageHeader
        title="Agents"
        description="Agents are discovered automatically when telemetry arrives."
      />
      <AgentsBody sort={sort} />
    </div>
  );
}

async function AgentsBody({ sort }: { sort: string }) {
  if (!hasServerApiKey()) {
    return (
      <ErrorBanner message="Set AGENTGAUGE_API_KEY in apps/dashboard/.env.local to load agents." />
    );
  }

  try {
    const { data } = await fetchAgents();
    if (data.length === 0) {
      return (
        <EmptyState title="No agents yet">
          <p>
            Agents appear the first time telemetry is ingested for an{" "}
            <code className="font-mono text-xs">agentId</code>. No separate registration is
            required.
          </p>
          <p>
            Configure the SDK and send a trace, then refresh. See{" "}
            <Link href="/overview">Overview</Link> for a quick start snippet.
          </p>
        </EmptyState>
      );
    }
    return <AgentsTable agents={sortAgents(data, sort)} sort={sort} />;
  } catch (error) {
    return (
      <ErrorBanner
        message={error instanceof ApiError ? error.message : "Failed to load agents from the API."}
      />
    );
  }
}

function sortAgents(agents: AgentSummary[], sort: string): AgentSummary[] {
  const copy = [...agents];
  copy.sort((a, b) => {
    switch (sort) {
      case "requests":
        return b.requestCount - a.requestCount;
      case "tokens":
        return b.totalTokens - a.totalTokens;
      case "cost":
        return b.estimatedCost - a.estimatedCost;
      case "errors":
        return (
          b.errorCount / Math.max(b.requestCount, 1) - a.errorCount / Math.max(a.requestCount, 1)
        );
      case "latency":
        return b.averageLatencyMs - a.averageLatencyMs;
      case "lastSeen":
      default:
        return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
    }
  });
  return copy;
}
