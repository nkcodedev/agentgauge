"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ModelPricingRow } from "@/lib/api-client";
import { formatAbsolute, formatPricePerMillion } from "@/lib/format";
import { Card, dataCellClass, dataHeadClass, dataTableClass, Drawer, EmptyState } from "./ui";

export interface PricingFilters {
  provider: string;
  status: string;
  source: string;
  q: string;
}

const kindLabel = {
  agentgauge_default: "AgentGauge default",
  custom: "Custom",
  override: "Override",
} as const;

const kindClass = {
  agentgauge_default: "bg-muted text-secondary",
  custom: "bg-info-soft text-info",
  override: "bg-warn-soft text-warn",
} as const;

const statusClass = {
  active: "bg-ok-soft text-ok",
  historical: "bg-muted text-secondary",
  upcoming: "bg-info-soft text-info",
} as const;

async function proxyJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error?.message ?? "Pricing could not be saved.");
  }
  return body as T;
}

function toIso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid effective date range.");
  return date.toISOString();
}

function localNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ModelPricingManager({
  rows,
  initialFilters,
}: {
  rows: ModelPricingRow[];
  initialFilters: PricingFilters;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState(initialFilters);
  const [items, setItems] = useState(rows);
  const [adding, setAdding] = useState(false);
  const [prefill, setPrefill] = useState<{ provider: string; model: string } | null>(null);
  const [editing, setEditing] = useState<ModelPricingRow | null>(null);
  const [history, setHistory] = useState<ModelPricingRow | null>(null);
  const [resetting, setResetting] = useState<ModelPricingRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const providers = useMemo(() => {
    const set = new Set(["openai", "anthropic", "google", ...items.map((row) => row.provider)]);
    return [...set].sort();
  }, [items]);

  const visible = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return items.filter((row) => {
      if (filters.provider && row.provider !== filters.provider) return false;
      if (filters.status && row.status !== filters.status) return false;
      if (filters.source && row.kind !== filters.source) return false;
      if (q && !row.model.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [filters, items]);

  function writeFilters(next: PricingFilters) {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.provider) params.set("provider", next.provider);
    if (next.status) params.set("status", next.status);
    if (next.source) params.set("source", next.source);
    if (next.q) params.set("q", next.q);
    const qs = params.toString();
    router.replace(`/settings/model-pricing${qs ? `?${qs}` : ""}`);
  }

  const historyRows = history
    ? items
        .filter((row) => row.provider === history.provider && row.model === history.model)
        .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
    : [];

  const filteredEmpty = items.length > 0 && visible.length === 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-secondary">
        AgentGauge calculates estimated cost from token usage and configured model pricing. Actual
        provider billing may differ. This catalog is installation-wide for self-hosted
        administrators.
      </p>
      <p className="text-2xs text-faint">
        Advanced pricing such as cache, batch, long-context, priority, or enterprise rates may
        require custom pricing and may not be fully represented. Previously unpriced traces may be
        priced by the background worker after a rate is added.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-2xs text-secondary">
          Provider
          <select
            aria-label="Provider"
            className="mt-1 block rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-fg"
            value={filters.provider}
            onChange={(e) => writeFilters({ ...filters, provider: e.target.value })}
          >
            <option value="">Any</option>
            {providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </label>
        <label className="text-2xs text-secondary">
          Status
          <select
            aria-label="Status"
            className="mt-1 block rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-fg"
            value={filters.status}
            onChange={(e) => writeFilters({ ...filters, status: e.target.value })}
          >
            <option value="">Any</option>
            <option value="active">Active</option>
            <option value="historical">Historical</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </label>
        <label className="text-2xs text-secondary">
          Source
          <select
            aria-label="Source"
            className="mt-1 block rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-fg"
            value={filters.source}
            onChange={(e) => writeFilters({ ...filters, source: e.target.value })}
          >
            <option value="">Any</option>
            <option value="agentgauge_default">AgentGauge default</option>
            <option value="custom">Custom</option>
            <option value="override">Override</option>
          </select>
        </label>
        <label className="text-2xs text-secondary">
          Model
          <input
            aria-label="Search models"
            value={filters.q}
            onChange={(e) => writeFilters({ ...filters, q: e.target.value })}
            placeholder="Search models"
            className="mt-1 block w-52 rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-fg"
          />
        </label>
        <button
          type="button"
          className="rounded-control bg-fg px-3 py-2 text-sm font-medium text-surface"
          onClick={() => {
            setError(null);
            setPrefill(null);
            setAdding(true);
          }}
        >
          Add model pricing
        </button>
      </div>

      {toast ? (
        <p role="status" className="text-sm text-ok">
          {toast}
        </p>
      ) : null}
      {error && !adding && !editing ? <p className="text-sm text-bad">{error}</p> : null}

      {items.length === 0 ? (
        <EmptyState title="No model pricing configured.">
          <p>AgentGauge uses model pricing to estimate trace costs.</p>
          <button
            type="button"
            className="rounded-control bg-fg px-3 py-2 text-sm font-medium text-surface"
            onClick={() => setAdding(true)}
          >
            Add model pricing
          </button>
        </EmptyState>
      ) : filteredEmpty ? (
        <EmptyState title="No pricing matches these filters.">
          <p>Try another provider, status, or model name.</p>
        </EmptyState>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="table-scroll">
            <table className={dataTableClass}>
              <thead className={dataHeadClass}>
                <tr>
                  {[
                    "Provider",
                    "Model",
                    "Input / 1M",
                    "Output / 1M",
                    "Effective from",
                    "Effective to",
                    "Source",
                    "Status",
                    "Actions",
                  ].map((label) => (
                    <th key={label} className={`${dataCellClass} font-medium`}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className={dataCellClass}>{row.provider}</td>
                    <td className={`${dataCellClass} font-mono text-xs`}>{row.model}</td>
                    <td className={dataCellClass}>
                      {formatPricePerMillion(row.inputPricePerMillion)}
                    </td>
                    <td className={dataCellClass}>
                      {formatPricePerMillion(row.outputPricePerMillion)}
                    </td>
                    <td className={dataCellClass} title={row.effectiveFrom}>
                      {formatAbsolute(row.effectiveFrom)}
                    </td>
                    <td className={dataCellClass} title={row.effectiveTo ?? undefined}>
                      {row.effectiveTo ? formatAbsolute(row.effectiveTo) : "—"}
                    </td>
                    <td className={dataCellClass}>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-2xs font-medium ${kindClass[row.kind]}`}
                      >
                        {kindLabel[row.kind]}
                      </span>
                    </td>
                    <td className={dataCellClass}>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-2xs font-medium capitalize ${statusClass[row.status]}`}
                      >
                        {row.status === "active"
                          ? "Active"
                          : row.status === "historical"
                            ? "Historical"
                            : "Upcoming"}
                      </span>
                    </td>
                    <td className={dataCellClass}>
                      <div className="flex gap-3">
                        {row.kind === "agentgauge_default" && row.status === "active" ? (
                          <button
                            type="button"
                            className="text-sm text-accent"
                            onClick={() => {
                              setError(null);
                              setPrefill({ provider: row.provider, model: row.model });
                              setAdding(true);
                            }}
                          >
                            Override
                          </button>
                        ) : null}
                        {row.kind !== "agentgauge_default" && row.status !== "historical" ? (
                          <button
                            type="button"
                            className="text-sm text-accent"
                            onClick={() => {
                              setError(null);
                              setEditing(row);
                            }}
                          >
                            Update pricing
                          </button>
                        ) : null}
                        {row.kind === "override" && row.status !== "historical" ? (
                          <button
                            type="button"
                            className="text-sm text-secondary"
                            onClick={() => setResetting(row)}
                          >
                            Reset to AgentGauge default
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="text-sm text-secondary"
                          onClick={() => setHistory(row)}
                        >
                          History
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {adding ? (
        <PricingForm
          title="Add model pricing"
          submitLabel="Add pricing"
          provider={prefill?.provider ?? ""}
          model={prefill?.model ?? ""}
          pending={pending}
          error={error}
          onClose={() => {
            setAdding(false);
            setError(null);
          }}
          onSubmit={async (values) => {
            setPending(true);
            setError(null);
            try {
              const created = await proxyJson<ModelPricingRow>("/api/backend/v1/model-pricing", {
                method: "POST",
                body: JSON.stringify(values),
              });
              setItems((prev) => [created, ...prev.filter((row) => row.id !== created.id)]);
              setAdding(false);
              setToast("Pricing added");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Pricing could not be saved.");
            } finally {
              setPending(false);
            }
          }}
        />
      ) : null}

      {editing ? (
        <PricingForm
          title="Update pricing"
          submitLabel="Update pricing"
          provider={editing.provider}
          model={editing.model}
          lockedIdentity
          pending={pending}
          error={error}
          summary={`${formatPricePerMillion(editing.inputPricePerMillion)} input · ${formatPricePerMillion(editing.outputPricePerMillion)} output · from ${formatAbsolute(editing.effectiveFrom)}`}
          onClose={() => {
            setEditing(null);
            setError(null);
          }}
          onSubmit={async (values) => {
            setPending(true);
            setError(null);
            try {
              const result = await proxyJson<{
                closed: ModelPricingRow;
                created: ModelPricingRow;
              }>(`/api/backend/v1/model-pricing/${encodeURIComponent(editing.id)}/supersede`, {
                method: "POST",
                body: JSON.stringify({
                  inputPricePerMillion: values.inputPricePerMillion,
                  outputPricePerMillion: values.outputPricePerMillion,
                  effectiveFrom: values.effectiveFrom,
                  ...(values.effectiveTo ? { effectiveTo: values.effectiveTo } : {}),
                }),
              });
              setItems((prev) => [
                result.created,
                ...prev.map((row) => (row.id === result.closed.id ? result.closed : row)),
              ]);
              setEditing(null);
              setToast("Pricing updated");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Pricing could not be saved.");
            } finally {
              setPending(false);
            }
          }}
        />
      ) : null}

      {resetting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-fg/20"
            onClick={() => setResetting(null)}
          />
          <div
            role="dialog"
            aria-label="Reset to AgentGauge default"
            className="relative z-10 w-full max-w-sm rounded-panel border border-line bg-surface p-4 shadow-overlay"
          >
            <p className="text-sm text-fg">
              End the override for {resetting.model}? Future traces use AgentGauge default pricing.
              This override row stays in history.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="rounded-control bg-fg px-3 py-2 text-sm text-surface"
                onClick={() => {
                  const row = resetting;
                  setResetting(null);
                  setPending(true);
                  void proxyJson<ModelPricingRow>(
                    `/api/backend/v1/model-pricing/${encodeURIComponent(row.id)}/reset`,
                    { method: "POST" },
                  )
                    .then((updated) => {
                      setItems((prev) =>
                        prev.map((item) => (item.id === updated.id ? updated : item)),
                      );
                      setToast("Override ended");
                    })
                    .catch((err: unknown) => {
                      setError(err instanceof Error ? err.message : "Pricing could not be saved.");
                    })
                    .finally(() => setPending(false));
                }}
              >
                Reset to AgentGauge default
              </button>
              <button
                type="button"
                className="text-sm text-secondary"
                onClick={() => setResetting(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Drawer title="Pricing history" open={history !== null} onClose={() => setHistory(null)}>
        {history ? (
          <div className="space-y-3">
            <p className="font-mono text-xs text-secondary">
              {history.provider} / {history.model}
            </p>
            {historyRows.map((row) => (
              <div key={row.id} className="rounded-control border border-line p-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-2xs ${kindClass[row.kind]}`}>
                    {kindLabel[row.kind]}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-2xs ${statusClass[row.status]}`}>
                    {row.status === "active"
                      ? "Active"
                      : row.status === "historical"
                        ? "Historical"
                        : "Upcoming"}
                  </span>
                </div>
                <p className="mt-2">
                  {formatPricePerMillion(row.inputPricePerMillion)} input ·{" "}
                  {formatPricePerMillion(row.outputPricePerMillion)} output
                </p>
                <p className="mt-1 text-2xs text-faint">
                  {formatAbsolute(row.effectiveFrom)} →{" "}
                  {row.effectiveTo ? formatAbsolute(row.effectiveTo) : "open"}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

function PricingForm({
  title,
  submitLabel,
  provider,
  model,
  lockedIdentity = false,
  summary,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  provider: string;
  model: string;
  lockedIdentity?: boolean;
  summary?: string;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: {
    provider: string;
    model: string;
    inputPricePerMillion: string;
    outputPricePerMillion: string;
    effectiveFrom: string;
    effectiveTo?: string;
  }) => Promise<void>;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-fg/20"
        onClick={onClose}
      />
      <form
        role="dialog"
        aria-label={title}
        className="relative z-10 w-full max-w-lg rounded-panel border border-line bg-surface p-4 shadow-overlay"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const inputPrice = String(fd.get("inputPrice") ?? "").trim();
          const outputPrice = String(fd.get("outputPrice") ?? "").trim();
          const from = String(fd.get("effectiveFrom") ?? "");
          const to = String(fd.get("effectiveTo") ?? "");
          const priceOk = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,8})?$/;
          if (!priceOk.test(inputPrice) || !priceOk.test(outputPrice)) {
            setFormError("Price must be a non-negative decimal.");
            return;
          }
          let effectiveFrom: string;
          let effectiveTo: string | undefined;
          try {
            effectiveFrom = toIso(from);
            effectiveTo = to ? toIso(to) : undefined;
            if (effectiveTo && new Date(effectiveTo) <= new Date(effectiveFrom)) {
              setFormError("Invalid effective date range.");
              return;
            }
          } catch {
            setFormError("Invalid effective date range.");
            return;
          }
          setFormError(null);
          void onSubmit({
            provider: String(fd.get("provider") ?? "").trim(),
            model: String(fd.get("model") ?? "").trim(),
            inputPricePerMillion: inputPrice,
            outputPricePerMillion: outputPrice,
            effectiveFrom,
            ...(effectiveTo ? { effectiveTo } : {}),
          });
        }}
      >
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {summary ? <p className="mt-1 text-2xs text-faint">{summary}</p> : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-2xs text-secondary">
            Provider
            <input
              name="provider"
              required
              defaultValue={provider}
              readOnly={lockedIdentity}
              list="pricing-providers"
              className="mt-1 block w-full rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-fg"
            />
            <datalist id="pricing-providers">
              <option value="openai" />
              <option value="anthropic" />
              <option value="google" />
            </datalist>
          </label>
          <label className="text-2xs text-secondary">
            Model
            <input
              name="model"
              required
              defaultValue={model}
              readOnly={lockedIdentity}
              className="mt-1 block w-full rounded-control border border-line bg-surface px-2 py-1.5 font-mono text-xs text-fg"
            />
          </label>
          <label className="text-2xs text-secondary">
            Input price / 1M
            <input
              name="inputPrice"
              required
              inputMode="decimal"
              placeholder="0.1500"
              className="mt-1 block w-full rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-fg"
            />
          </label>
          <label className="text-2xs text-secondary">
            Output price / 1M
            <input
              name="outputPrice"
              required
              inputMode="decimal"
              placeholder="0.6000"
              className="mt-1 block w-full rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-fg"
            />
          </label>
          <label className="text-2xs text-secondary">
            Effective from
            <input
              name="effectiveFrom"
              type="datetime-local"
              required
              defaultValue={localNow()}
              className="mt-1 block w-full rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-fg"
            />
          </label>
          <label className="text-2xs text-secondary">
            Effective to
            <input
              name="effectiveTo"
              type="datetime-local"
              className="mt-1 block w-full rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-fg"
            />
          </label>
        </div>
        {formError || error ? <p className="mt-3 text-sm text-bad">{formError ?? error}</p> : null}
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-control bg-fg px-3 py-2 text-sm font-medium text-surface disabled:opacity-60"
          >
            {pending ? "Saving…" : submitLabel}
          </button>
          <button type="button" className="text-sm text-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
