"use client";

import { useState, useTransition } from "react";
import type { ApiKeyListItem, CreatedApiKey } from "@/lib/api-client";
import { formatAbsolute, formatRelative } from "@/lib/format";
import { Card, dataCellClass, dataHeadClass, dataTableClass } from "./ui";

async function proxyJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export function ApiKeysManager({ initialKeys }: { initialKeys: ApiKeyListItem[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end justify-between gap-4 p-4">
        <div>
          <h2 className="text-sm font-semibold">Create API key</h2>
          <p className="mt-1 text-2xs text-faint">The plaintext key is shown once.</p>
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setCreated(null);
            const fd = new FormData(e.currentTarget);
            const name = String(fd.get("name") ?? "").trim();
            const environment = String(fd.get("environment") ?? "live") as "live" | "test";
            startTransition(async () => {
              try {
                const result = await proxyJson<CreatedApiKey>("/api/backend/v1/api-keys", {
                  method: "POST",
                  body: JSON.stringify({ name, environment }),
                });
                setCreated(result);
                setKeys((prev) => [
                  {
                    id: result.id,
                    name: result.name,
                    prefix: result.prefix,
                    environment: result.environment,
                    createdAt: result.createdAt,
                    lastUsedAt: result.lastUsedAt,
                    revokedAt: result.revokedAt,
                  },
                  ...prev,
                ]);
                e.currentTarget.reset();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to create key");
              }
            });
          }}
        >
          <label className="text-2xs text-secondary">
            Name
            <input
              name="name"
              required
              maxLength={128}
              className="mt-1 block w-56 rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-fg"
              placeholder="CI ingest"
            />
          </label>
          <label className="text-2xs text-secondary">
            Environment
            <select
              name="environment"
              className="mt-1 block rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-fg"
              defaultValue="live"
            >
              <option value="live">live</option>
              <option value="test">test</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-control bg-fg px-3 py-2 text-sm font-medium text-surface disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create key"}
          </button>
        </form>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        {created ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-fg/20" />
            <div
              role="status"
              className="relative z-10 w-full max-w-lg rounded-panel border border-line bg-surface p-4 shadow-overlay"
            >
              <p className="font-medium text-fg">Copy this key now. It will not be shown again.</p>
              <code className="mt-3 block break-all rounded-control bg-muted px-2 py-2 font-mono text-2xs">
                {created.apiKey}
              </code>
              <pre className="mt-3 overflow-x-auto rounded-control bg-muted p-3 text-2xs">{`npm install @agentgauge/node

const gauge = new AgentGauge({
  apiKey: "${created.apiKey}",
  endpoint: "http://localhost:3000",
});`}</pre>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="rounded-control bg-fg px-3 py-2 text-sm text-surface"
                  onClick={() => void navigator.clipboard.writeText(created.apiKey)}
                >
                  Copy key
                </button>
                <button
                  type="button"
                  className="text-sm text-secondary"
                  onClick={() => setCreated(null)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {toast ? (
          <p role="status" className="mt-3 text-sm text-ok">
            {toast}
          </p>
        ) : null}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="table-scroll">
          <table className={dataTableClass}>
            <thead className={dataHeadClass}>
              <tr>
                {["Name", "Prefix", "Environment", "Created", "Last used", "Status", "Actions"].map(
                  (label) => (
                    <th key={label} className={`${dataCellClass} font-medium`}>
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-t border-line">
                  <td className={dataCellClass}>{key.name}</td>
                  <td className={`${dataCellClass} font-mono text-xs`}>{key.prefix}…</td>
                  <td className={dataCellClass}>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-2xs font-medium ${
                        key.environment === "test" ? "bg-info-soft text-info" : "bg-ok-soft text-ok"
                      }`}
                    >
                      {key.environment}
                    </span>
                  </td>
                  <td className={dataCellClass} title={formatAbsolute(key.createdAt)}>
                    {formatRelative(key.createdAt)}
                  </td>
                  <td
                    className={dataCellClass}
                    title={key.lastUsedAt ? formatAbsolute(key.lastUsedAt) : undefined}
                  >
                    {key.lastUsedAt ? formatRelative(key.lastUsedAt) : "—"}
                  </td>
                  <td className={dataCellClass}>{key.revokedAt ? "revoked" : "active"}</td>
                  <td className={dataCellClass}>
                    {!key.revokedAt ? (
                      <button
                        type="button"
                        className="text-sm text-bad"
                        disabled={pending}
                        onClick={() => setConfirmId(key.id)}
                      >
                        Revoke
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {confirmId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-fg/20"
            onClick={() => setConfirmId(null)}
          />
          <div
            role="dialog"
            aria-label="Revoke API key"
            className="relative z-10 w-full max-w-sm rounded-panel border border-line bg-surface p-4 shadow-overlay"
          >
            <p className="text-sm text-fg">Revoke this key? Requests using it will fail.</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="rounded-control bg-bad px-3 py-2 text-sm text-white"
                onClick={() => {
                  const id = confirmId;
                  setConfirmId(null);
                  setError(null);
                  startTransition(async () => {
                    try {
                      const revoked = await proxyJson<ApiKeyListItem>(
                        `/api/backend/v1/api-keys/${encodeURIComponent(id)}/revoke`,
                        { method: "POST" },
                      );
                      setKeys((prev) => prev.map((k) => (k.id === id ? revoked : k)));
                      setToast("Key revoked");
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to revoke key");
                    }
                  });
                }}
              >
                Revoke key
              </button>
              <button
                type="button"
                className="text-sm text-secondary"
                onClick={() => setConfirmId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
