import { ApiError, fetchRuns } from "@/lib/api-client";
import { hasServerApiKey } from "@/lib/env";
import { rangeFromPreset, type RangePreset } from "@/lib/format";
import { RunFilters } from "@/components/run-filters";
import { RunsTable } from "@/components/runs-table";
import { EmptyState, ErrorBanner, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    agentId?: string;
    status?: string;
    cursor?: string;
  }>;
}) {
  const params = await searchParams;
  const range = (
    ["24h", "7d", "30d"].includes(params.range ?? "") ? params.range : "7d"
  ) as RangePreset;

  return (
    <div>
      <PageHeader
        title="Runs"
        description="Agent-scoped execution sessions with aggregated cost, tokens, and retries."
      />
      <RunsBody
        range={range}
        agentId={params.agentId}
        status={params.status}
        cursor={params.cursor}
      />
    </div>
  );
}

async function RunsBody(props: {
  range: RangePreset;
  agentId?: string;
  status?: string;
  cursor?: string;
}) {
  if (!hasServerApiKey()) {
    return <ErrorBanner message="Set AGENTGAUGE_API_KEY to load runs." />;
  }

  try {
    const window = rangeFromPreset(props.range);
    const page = await fetchRuns({
      ...window,
      ...(props.agentId ? { agentId: props.agentId } : {}),
      ...(props.status ? { status: props.status } : {}),
      ...(props.cursor ? { cursor: props.cursor } : {}),
      limit: 25,
    });

    const filters = {
      agentId: props.agentId ?? "",
      status: props.status ?? "",
      range: props.range,
    };

    if (page.data.length === 0 && !props.cursor) {
      return (
        <div className="space-y-3">
          <RunFilters filters={filters} />
          <EmptyState title="No runs">
            <p>
              Runs are created via the SDK or POST{" "}
              <code className="font-mono text-xs">/v1/runs</code>. Attach traces with a{" "}
              <code className="font-mono text-xs">runId</code> to populate metrics.
            </p>
          </EmptyState>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <RunFilters filters={filters} />
        <RunsTable
          runs={page.data}
          nextCursor={page.nextCursor}
          range={props.range}
          filters={{ agentId: filters.agentId, status: filters.status }}
        />
      </div>
    );
  } catch (error) {
    return (
      <ErrorBanner message={error instanceof ApiError ? error.message : "Failed to load runs."} />
    );
  }
}
