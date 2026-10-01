/**
 * Server-only dashboard configuration.
 * AGENTGAUGE_API_KEY must never be imported into client components.
 */

export function getApiBaseUrl(): string {
  return (process.env.AGENTGAUGE_API_URL ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
}

export function getServerApiKey(): string {
  const key = process.env.AGENTGAUGE_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "AGENTGAUGE_API_KEY is not set. Configure it in apps/dashboard/.env.local (server-side only).",
    );
  }
  return key;
}

export function hasServerApiKey(): boolean {
  return Boolean(process.env.AGENTGAUGE_API_KEY?.trim());
}
