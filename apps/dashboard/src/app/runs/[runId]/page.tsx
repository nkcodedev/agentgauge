import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError, fetchRun } from "@/lib/api-client";
import { hasServerApiKey } from "@/lib/env";
import { RunDetailView } from "@/components/run-detail";
import { ErrorBanner, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;

  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/runs" className="text-accent no-underline">
          ← Back to runs
        </Link>
      </p>
      <PageHeader
        title="Run detail"
        description="Aggregated metrics and traces for this session."
      />
      <RunBody runId={runId} />
    </div>
  );
}

async function RunBody({ runId }: { runId: string }) {
  if (!hasServerApiKey()) {
    return <ErrorBanner message="Set AGENTGAUGE_API_KEY to load this run." />;
  }

  try {
    const run = await fetchRun(runId);
    return <RunDetailView run={run} />;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    return (
      <ErrorBanner message={error instanceof ApiError ? error.message : "Failed to load run."} />
    );
  }
}
