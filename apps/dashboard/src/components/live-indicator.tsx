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
      className="flex items-center gap-2 text-2xs text-secondary"
      role="status"
      aria-live="polite"
      data-testid="live-indicator"
      data-status={status}
    >
      <span
        aria-hidden
        className={`inline-block h-2 w-2 rounded-full ${
          live ? "animate-pulse bg-ok" : status === "offline" ? "bg-faint" : "bg-warn"
        }`}
      />
      <span>{labelFor(status)}</span>
    </div>
  );
}
