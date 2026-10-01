import { ApiError, fetchModelPricing } from "@/lib/api-client";
import { hasServerApiKey } from "@/lib/env";
import { ModelPricingManager, type PricingFilters } from "@/components/model-pricing-manager";
import { SettingsNav } from "@/components/settings-nav";
import { ErrorBanner, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ModelPricingPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string; status?: string; source?: string; q?: string }>;
}) {
  const params = await searchParams;
  const filters: PricingFilters = {
    provider: params.provider ?? "",
    status: params.status ?? "",
    source: params.source ?? "",
    q: params.q ?? "",
  };

  return (
    <div>
      <SettingsNav />
      <PageHeader
        title="Model pricing"
        description="Installation pricing used to estimate trace cost. AgentGauge default rows stay in history. Overrides and custom models apply to future traces."
      />
      <ModelPricingBody filters={filters} />
    </div>
  );
}

async function ModelPricingBody({ filters }: { filters: PricingFilters }) {
  if (!hasServerApiKey()) {
    return (
      <ErrorBanner message="Set AGENTGAUGE_API_KEY in apps/dashboard/.env.local to manage model pricing." />
    );
  }

  try {
    const { data } = await fetchModelPricing();
    return <ModelPricingManager rows={data} initialFilters={filters} />;
  } catch (error) {
    return (
      <ErrorBanner
        message={
          error instanceof ApiError
            ? `Pricing could not be loaded. ${error.message}`
            : "Pricing could not be loaded. Refresh the page to retry."
        }
      />
    );
  }
}
