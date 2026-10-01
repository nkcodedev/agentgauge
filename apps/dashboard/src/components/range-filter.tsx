"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { RangePreset } from "@/lib/format";

const presets: { id: RangePreset; label: string }[] = [
  { id: "24h", label: "24h" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
];

export function RangeFilter({ defaultPreset = "7d" }: { defaultPreset?: RangePreset }) {
  const router = useRouter();
  const search = useSearchParams();
  const custom = Boolean(search.get("from") && search.get("to"));
  const current = (search.get("range") as RangePreset | null) ?? defaultPreset;
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex items-center gap-1">
      <div
        className="inline-flex rounded-control border border-line bg-surface p-0.5"
        role="group"
        aria-label="Time range"
      >
        {presets.map((p) => {
          const active = !custom && current === p.id;
          return (
            <button
              key={p.id}
              type="button"
              className={`rounded-control px-2.5 py-1 text-2xs ${
                active ? "bg-fg text-surface" : "text-secondary hover:bg-muted"
              }`}
              aria-pressed={active}
              onClick={() => {
                const next = new URLSearchParams(search.toString());
                next.set("range", p.id);
                next.delete("from");
                next.delete("to");
                router.push(`?${next.toString()}`);
              }}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          className={`rounded-control px-2.5 py-1 text-2xs ${
            custom ? "bg-fg text-surface" : "text-secondary hover:bg-muted"
          }`}
          aria-pressed={custom}
          onClick={() => setOpen((value) => !value)}
        >
          Custom
        </button>
      </div>
      {open ? (
        <form
          className="absolute right-0 top-10 z-30 flex items-end gap-2 rounded-panel border border-line bg-surface p-3 shadow-overlay"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const from = String(data.get("from") ?? "");
            const to = String(data.get("to") ?? "");
            if (!from || !to) return;
            const next = new URLSearchParams(search.toString());
            next.set("range", "custom");
            next.set("from", new Date(from).toISOString());
            next.set("to", new Date(to).toISOString());
            router.push(`?${next.toString()}`);
            setOpen(false);
          }}
        >
          <label className="text-2xs text-secondary">
            From
            <input
              name="from"
              type="datetime-local"
              required
              className="mt-1 block rounded-control border border-line bg-surface px-2 py-1 text-sm"
            />
          </label>
          <label className="text-2xs text-secondary">
            To
            <input
              name="to"
              type="datetime-local"
              required
              className="mt-1 block rounded-control border border-line bg-surface px-2 py-1 text-sm"
            />
          </label>
          <button type="submit" className="rounded-control bg-fg px-2 py-1 text-2xs text-surface">
            Apply
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function MobileNav() {
  return (
    <nav className="mb-4 flex gap-2 overflow-x-auto md:hidden" aria-label="Mobile">
      {[
        ["/overview", "Overview"],
        ["/agents", "Agents"],
        ["/runs", "Runs"],
        ["/traces", "Traces"],
        ["/settings/api-keys", "Settings"],
      ].map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className="whitespace-nowrap rounded-md border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-800 no-underline"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
