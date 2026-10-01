"use client";

import { useRouter, useSearchParams } from "next/navigation";

const runStatuses = [
  { value: "", label: "Any status" },
  { value: "running", label: "Running" },
  { value: "success", label: "Success" },
  { value: "error", label: "Error" },
  { value: "cancelled", label: "Cancelled" },
  { value: "timeout", label: "Timeout" },
];

export function RunFilters({
  filters,
}: {
  filters: { agentId: string; status: string; range: string };
}) {
  const router = useRouter();
  const search = useSearchParams();

  function push(next: { agentId?: string; status?: string }) {
    const q = new URLSearchParams(search.toString());
    const agentId = next.agentId ?? filters.agentId;
    const status = next.status ?? filters.status;
    if (agentId) q.set("agentId", agentId);
    else q.delete("agentId");
    if (status) q.set("status", status);
    else q.delete("status");
    q.delete("cursor");
    router.push(`/runs?${q.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {runStatuses.map((status) => {
        const active = filters.status === status.value;
        return (
          <button
            key={status.value || "any"}
            type="button"
            aria-pressed={active}
            className={`rounded-full border px-3 py-1 text-2xs ${
              active ? "border-accent bg-accent-soft text-accent" : "border-line text-secondary"
            }`}
            onClick={() => push({ status: status.value })}
          >
            {status.label}
          </button>
        );
      })}
      <form
        className="ml-auto"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          push({ agentId: String(data.get("agentId") ?? "").trim() });
        }}
      >
        <input
          name="agentId"
          defaultValue={filters.agentId}
          placeholder="Filter by agent"
          aria-label="Agent"
          className="rounded-control border border-line bg-surface px-2 py-1.5 text-sm"
        />
      </form>
    </div>
  );
}
