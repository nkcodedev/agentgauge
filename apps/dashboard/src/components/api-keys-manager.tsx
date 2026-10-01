"use client";

import { useState, useTransition } from "react";
import type { ApiKeyListItem, CreatedApiKey } from "@/lib/api-client";
import { formatAbsolute, formatRelative } from "@/lib/format";
import { Card } from "./ui";

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

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-sm font-semibold">Create API key</h2>
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
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
          <label className="text-xs text-ink-600">
            Name
            <input
              name="name"
              required
              maxLength={128}
              className="mt-1 block w-56 rounded border border-ink-200 px-2 py-1.5 text-sm"
              placeholder="CI ingest"
            />
          </label>
          <label className="text-xs text-ink-600">
            Environment
            <select
              name="environment"
              className="mt-1 block rounded border border-ink-200 px-2 py-1.5 text-sm"
              defaultValue="live"
            >
              <option value="live">live</option>
              <option value="test">test</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-ink-900 px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create key"}
          </button>
        </form>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        {created ? (
          <div
            role="status"
            className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
          >
            <p className="font-medium">Copy this key now. It will not be shown again.</p>
            <code className="mt-2 block break-all rounded bg-white px-2 py-2 font-mono text-xs">
              {created.apiKey}
            </code>
          </div>
        ) : null}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-ink-50 text-xs uppercase text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Prefix</th>
                <th className="px-4 py-3 font-medium">Env</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Last used</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-t border-ink-100">
                  <td className="px-4 py-3">{key.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{key.prefix}…</td>
                  <td className="px-4 py-3">{key.environment}</td>
                  <td className="px-4 py-3" title={formatAbsolute(key.createdAt)}>
                    {formatRelative(key.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {key.lastUsedAt ? formatRelative(key.lastUsedAt) : "—"}
                  </td>
                  <td className="px-4 py-3">{key.revokedAt ? "revoked" : "active"}</td>
                  <td className="px-4 py-3">
                    {!key.revokedAt ? (
                      <button
                        type="button"
                        className="text-sm text-red-700"
                        disabled={pending}
                        onClick={() => {
                          setError(null);
                          startTransition(async () => {
                            try {
                              const revoked = await proxyJson<ApiKeyListItem>(
                                `/api/backend/v1/api-keys/${encodeURIComponent(key.id)}/revoke`,
                                { method: "POST" },
                              );
                              setKeys((prev) => prev.map((k) => (k.id === key.id ? revoked : k)));
                            } catch (err) {
                              setError(err instanceof Error ? err.message : "Failed to revoke key");
                            }
                          });
                        }}
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
    </div>
  );
}
