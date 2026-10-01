import { ApiError, fetchTraces, fetchTrace } from "@/lib/api-client";
import { hasServerApiKey } from "@/lib/env";
import { rangeFromPreset, type RangePreset } from "@/lib/format";
import { MobileNav, RangeFilter } from "@/components/range-filter";
import { EmptyState, ErrorBanner, PageHeader } from "@/components/ui";
import { TracesExplorer } from "@/components/traces-explorer";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TracesPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    agentId?: string;
    provider?: string;
    model?: string;
    status?: string;
    cursor?: string;
    eventId?: string;
  }>;
}) {
  const params = await searchParams;
  const range = (
    ["24h", "7d", "30d"].includes(params.range ?? "") ? params.range : "7d"
  ) as RangePreset;

  return (
    <div>
      <MobileNav />
      <PageHeader
        title="Traces"
        description="Inspect individual operations. AgentGauge does not store prompts or completions."
        actions={
          <Suspense fallback={<Skeleton className="h-9 w-40" />}>
            <RangeFilter defaultPreset={range} />
          </Suspense>
        }
      />
      <TracesBody
        range={range}
        agentId={params.agentId}
        provider={params.provider}
        model={params.model}
        status={params.status}
        cursor={params.cursor}
        eventId={params.eventId}
      />
    </div>
  );
}

async function TracesBody(props: {
  range: RangePreset;
  agentId?: string;
  provider?: string;
  model?: string;
  status?: string;
  cursor?: string;
  eventId?: string;
}) {
  if (!hasServerApiKey()) {
    return <ErrorBanner message="Set AGENTGAUGE_API_KEY to load traces." />;
  }

  try {
    const window = rangeFromPreset(props.range);
    const [page, detail] = await Promise.all([
      fetchTraces({
        ...window,
        ...(props.agentId ? { agentId: props.agentId } : {}),
        ...(props.provider ? { provider: props.provider } : {}),
        ...(props.model ? { model: props.model } : {}),
        ...(props.status ? { status: props.status } : {}),
        ...(props.cursor ? { cursor: props.cursor } : {}),
        limit: 25,
      }),
      props.eventId ? fetchTrace(props.eventId).catch(() => null) : Promise.resolve(null),
    ]);

    if (page.data.length === 0 && !props.cursor) {
      return (
        <EmptyState title="No traces">
          <p>
            Check that the SDK endpoint and API key match this project, then send a sample trace.
          </p>
          <pre className="overflow-x-auto rounded-md bg-ink-950 p-3 font-mono text-xs text-ink-50">{`trace.end({ inputTokens: 100, outputTokens: 30 });
await gauge.flush();`}</pre>
        </EmptyState>
      );
    }

    return (
      <TracesExplorer
        traces={page.data}
        nextCursor={page.nextCursor}
        selected={detail}
        filters={{
          agentId: props.agentId ?? "",
          provider: props.provider ?? "",
          model: props.model ?? "",
          status: props.status ?? "",
          range: props.range,
        }}
      />
    );
  } catch (error) {
    return (
      <ErrorBanner message={error instanceof ApiError ? error.message : "Failed to load traces."} />
    );
  }
}
