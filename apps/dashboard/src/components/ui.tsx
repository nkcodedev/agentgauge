import type { ReactNode } from "react";
import { formatRunStatusLabel } from "@/lib/format";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-title font-semibold tracking-tight text-fg">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-secondary">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-panel border border-line bg-surface ${className}`}>{children}</div>
  );
}

export function ChartCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-4 ${className}`}>
      <div className="mb-3 text-sm font-medium text-fg">{title}</div>
      {children}
    </Card>
  );
}

export const dataTableClass =
  "w-max min-w-full border-collapse whitespace-nowrap text-left text-xs";
export const dataHeadClass = "sticky top-0 bg-muted text-2xs text-secondary";
export const dataCellClass = "px-2 py-2 align-middle";

export function KpiCard({
  label,
  value,
  hint,
  delta,
  sparkline,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: { value: number; label?: string } | null;
  sparkline?: number[];
}) {
  return (
    <Card className="rounded-lg px-4 py-3">
      <div className="text-[13px] text-secondary">{label}</div>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div
          className="text-2xl font-semibold text-fg"
          style={{ fontSize: 28, lineHeight: "32px" }}
        >
          {value}
        </div>
        {sparkline && sparkline.length > 1 ? <Sparkline values={sparkline} /> : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {delta ? <DeltaBadge value={delta.value} label={delta.label} /> : null}
        {hint ? <div className="text-2xs text-faint">{hint}</div> : null}
      </div>
    </Card>
  );
}

export function DeltaBadge({
  value,
  label = "vs earlier in range",
}: {
  value: number;
  label?: string;
}) {
  const up = value > 0;
  const flat = Math.abs(value) < 0.005;
  const tone = flat ? "text-faint" : up ? "text-ok" : "text-bad";
  const arrow = flat ? "–" : up ? "↑" : "↓";
  const pct = `${Math.abs(value * 100).toFixed(0)}%`;
  return (
    <span className={`text-2xs ${tone}`} title={label}>
      {arrow} {pct}
    </span>
  );
}

export function Sparkline({
  values,
  width = 72,
  height = 22,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const d = values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / span) * (height - 2) - 1;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} aria-hidden className="shrink-0 text-accent">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="border-dashed p-4">
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      <div className="mt-2 space-y-3 text-sm text-secondary">{children}</div>
    </Card>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="mb-4 rounded-control border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad"
    >
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="mt-2 text-sm font-medium underline" onClick={onRetry}>
          Retry
        </button>
      ) : (
        <p className="mt-1 text-2xs">Refresh the page to retry.</p>
      )}
    </div>
  );
}

function statusPillStyle(
  status: string,
  kind: "trace" | "run",
): { className: string; label: string } {
  if (kind === "run") {
    switch (status) {
      case "running":
        return { className: "bg-info-soft text-info", label: formatRunStatusLabel(status) };
      case "success":
        return { className: "bg-ok-soft text-ok", label: formatRunStatusLabel(status) };
      case "error":
        return { className: "bg-bad-soft text-bad", label: formatRunStatusLabel(status) };
      case "cancelled":
      case "timeout":
        return { className: "bg-warn-soft text-warn", label: formatRunStatusLabel(status) };
      default:
        return { className: "bg-muted text-secondary", label: status };
    }
  }
  const ok = status === "success";
  return {
    className: ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad",
    label: status,
  };
}

export function StatusPill({ status, kind = "trace" }: { status: string; kind?: "trace" | "run" }) {
  const { className, label } = statusPillStyle(status, kind);
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-2xs font-medium ${className}`}>
      {label}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-control bg-muted ${className}`} />;
}

export function PrivacyBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-muted px-2 py-0.5 text-2xs text-secondary">
      AgentGauge does not store prompts or completions
    </span>
  );
}

export function Drawer({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close drawer"
        className="absolute inset-0 bg-fg/20"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-label={title}
        className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-overlay"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          <button type="button" className="text-sm text-secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
      </aside>
    </div>
  );
}
