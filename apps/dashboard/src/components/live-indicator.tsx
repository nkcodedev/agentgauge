"use client";

import { useLiveConnectionStatus, type LiveConnectionStatus } from "@/components/live-events";

function labelFor(status: LiveConnectionStatus): string {
  switch (status) {
    case "live":
      return "Live";
    case "connecting":
      return "Connecting…";
    case "reconnecting":
      return "Reconnecting…";
    case "offline":
      return "Offline";
  }
}

export function LiveIndicator() {
  const status = useLiveConnectionStatus();
  const live = status === "live";

  return (
    <div
      className="mt-4 flex items-center gap-2 text-xs text-ink-600"
      role="status"
      aria-live="polite"
      data-testid="live-indicator"
      data-status={status}
    >
      <span
        aria-hidden
        className={`inline-block h-2 w-2 rounded-full ${
          live ? "bg-emerald-500" : status === "offline" ? "bg-ink-400" : "bg-amber-500"
        }`}
      />
      <span>{labelFor(status)}</span>
    </div>
  );
}
