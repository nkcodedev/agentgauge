"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { LiveIndicator } from "@/components/live-indicator";
import { useAutoRefresh } from "@/components/live-events";
import { RangeFilter } from "@/components/range-filter";
import { CommandPalette } from "@/components/command-palette";

function crumbs(pathname: string): string[] {
  if (pathname.startsWith("/settings/model-pricing")) return ["Settings", "Model pricing"];
  if (pathname.startsWith("/settings")) return ["Settings", "API keys"];
  if (pathname.startsWith("/agents/"))
    return ["Agents", decodeURIComponent(pathname.split("/")[2] ?? "")];
  if (pathname.startsWith("/runs/")) return ["Runs", "Run detail"];
  if (pathname.startsWith("/overview")) return ["Overview"];
  if (pathname.startsWith("/agents")) return ["Agents"];
  if (pathname.startsWith("/runs")) return ["Runs"];
  if (pathname.startsWith("/traces")) return ["Traces"];
  return ["AgentGauge"];
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("ag-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(stored === "dark" || (stored !== "light" && prefersDark));
  }, []);

  function apply(next: "light" | "dark") {
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("ag-theme", next);
    setDark(next === "dark");
  }

  return (
    <button
      type="button"
      className="rounded-control border border-line px-2 py-1.5 text-secondary"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => apply(dark ? "light" : "dark")}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const parts = crumbs(pathname);
  const { autoRefresh, setAutoRefresh } = useAutoRefresh();
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur md:px-6">
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1 text-sm text-secondary">
        {parts.map((part, index) => (
          <span key={`${part}-${index}`}>
            {index > 0 ? <span className="px-1 text-faint">/</span> : null}
            <span className={index === parts.length - 1 ? "text-fg" : undefined}>{part}</span>
          </span>
        ))}
      </nav>
      <Suspense fallback={<div className="h-9 w-40 rounded-control bg-muted" />}>
        <RangeFilter />
      </Suspense>
      <button
        type="button"
        aria-pressed={autoRefresh}
        className="rounded-control border border-line px-2 py-1.5 text-2xs text-secondary"
        onClick={() => setAutoRefresh(!autoRefresh)}
      >
        {autoRefresh ? "Auto-refresh on" : "Auto-refresh off"}
      </button>
      <LiveIndicator />
      <ThemeToggle />
      <button
        type="button"
        className="rounded-control border border-line px-2 py-1.5 text-2xs text-secondary"
        onClick={() => setPalette(true)}
      >
        Search
        <kbd className="ml-2 hidden rounded border border-line px-1 md:inline">⌘K</kbd>
      </button>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </header>
  );
}
