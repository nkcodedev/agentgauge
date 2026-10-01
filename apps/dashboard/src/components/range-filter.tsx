"use client";

import Link from "next/link";
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
  const current = (search.get("range") as RangePreset | null) ?? defaultPreset;

  return (
    <div
      className="inline-flex rounded-control border border-line bg-surface p-0.5"
      role="group"
      aria-label="Time range"
    >
      {presets.map((p) => {
        const active = current === p.id;
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
              router.push(`?${next.toString()}`);
            }}
          >
            {p.label}
          </button>
        );
      })}
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
