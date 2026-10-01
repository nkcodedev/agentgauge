import { ApiError, fetchApiKeys } from "@/lib/api-client";
import { hasServerApiKey } from "@/lib/env";
import { ErrorBanner, PageHeader } from "@/components/ui";
import { ApiKeysManager } from "@/components/api-keys-manager";
import { SettingsNav } from "@/components/settings-nav";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  return (
    <div>
      <SettingsNav />
      <PageHeader
        title="API keys"
        description="Create and revoke project API keys. The full plaintext key is shown only once at creation. The dashboard reads AGENTGAUGE_API_KEY on the server; the browser never receives it."
      />
      <ApiKeysBody />
    </div>
  );
}

async function ApiKeysBody() {
  if (!hasServerApiKey()) {
    return (
      <ErrorBanner message="Set AGENTGAUGE_API_KEY in apps/dashboard/.env.local to manage keys for that project." />
    );
  }

  try {
    const { data } = await fetchApiKeys();
    return <ApiKeysManager initialKeys={data} />;
  } catch (error) {
    return (
      <ErrorBanner
        message={error instanceof ApiError ? error.message : "Failed to load API keys."}
      />
    );
  }
}
