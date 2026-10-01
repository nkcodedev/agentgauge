"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bot, KeyRound, LayoutDashboard, ListTree, Play } from "lucide-react";

const links = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/runs", label: "Runs", icon: Play },
  { href: "/traces", label: "Traces", icon: ListTree },
  { href: "/settings/api-keys", label: "Settings", icon: KeyRound },
];

export function Sidebar({ environment }: { environment: "live" | "test" }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-14 shrink-0 flex-col border-r border-line bg-surface md:w-56">
      <div className="flex items-center gap-2 px-3 py-4 md:px-4">
        <Activity className="h-5 w-5 shrink-0 text-accent" aria-hidden />
        <div className="hidden min-w-0 md:block">
          <div className="truncate text-sm font-semibold text-fg">AgentGauge</div>
          <span
            className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-2xs font-medium ${
              environment === "test" ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok"
            }`}
          >
            {environment}
          </span>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-2" aria-label="Primary">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              title={link.label}
              className={`relative flex items-center gap-3 rounded-control px-2 py-2 text-sm no-underline ${
                active
                  ? "bg-accent-soft text-accent"
                  : "text-secondary hover:bg-muted hover:text-fg"
              }`}
            >
              {active ? (
                <span
                  className="absolute left-0 top-1.5 h-6 w-0.5 rounded-full bg-accent"
                  aria-hidden
                />
              ) : null}
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden md:inline">{link.label}</span>
              <span className="sr-only md:hidden">{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
