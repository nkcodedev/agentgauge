import { ApiError, fetchTraces, fetchTrace } from "@/lib/api-client";
import { hasServerApiKey } from "@/lib/env";
import { resolveWindow, type RangePreset } from "@/lib/format";
import { EmptyState, ErrorBanner, PageHeader, PrivacyBadge } from "@/components/ui";
import { TracesExplorer } from "@/components/traces-explorer";

export const dynamic = "force-dynamic";

export default async function TracesPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    agentId?: string;
    provider?: string;
    model?: string;
    status?: string;
    cursor?: string;
    eventId?: string;
  }>;
}) {
  const params = await searchParams;
  const window = resolveWindow(params);
  const range = (window.preset === "custom" ? "7d" : window.preset) as RangePreset;

  return (
    <div>
      <PageHeader
        title="Traces"
        description="Inspect individual operations."
        actions={<PrivacyBadge />}
      />
      <TracesBody
        range={range}
        from={window.from}
        to={window.to}
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
  from: string;
  to: string;
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
    const [page, detail] = await Promise.all([
      fetchTraces({
        from: props.from,
        to: props.to,
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
          <pre className="overflow-x-auto rounded-control bg-muted p-3 font-mono text-xs text-fg">{`trace.end({ inputTokens: 100, outputTokens: 30 });
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
