"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const destinations = [
  { href: "/overview", label: "Overview" },
  { href: "/agents", label: "Agents" },
  { href: "/runs", label: "Runs" },
  { href: "/traces", label: "Traces" },
  { href: "/settings/api-keys", label: "Settings" },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pages = destinations.filter((item) => !q || item.label.toLowerCase().includes(q));
    if (!q) return pages;
    return [
      ...pages,
      {
        href: `/agents?q=${encodeURIComponent(query.trim())}`,
        label: `Agents matching “${query.trim()}”`,
      },
      {
        href: `/traces?agentId=${encodeURIComponent(query.trim())}`,
        label: `Traces for “${query.trim()}”`,
      },
      {
        href: `/runs?agentId=${encodeURIComponent(query.trim())}`,
        label: `Runs for “${query.trim()}”`,
      },
    ];
  }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[15vh]">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-fg/20"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label="Command palette"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-panel border border-line bg-surface shadow-overlay"
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Jump to a page or agent"
          className="w-full border-b border-line bg-transparent px-4 py-3 text-sm text-fg outline-none"
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && items[0]) {
              router.push(items[0].href);
              onClose();
            }
          }}
        />
        <ul className="max-h-72 overflow-auto py-1">
          {items.map((item) => (
            <li key={item.href + item.label}>
              <button
                type="button"
                className="w-full px-4 py-2 text-left text-sm text-fg hover:bg-muted"
                onClick={() => {
                  router.push(item.href);
                  onClose();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
