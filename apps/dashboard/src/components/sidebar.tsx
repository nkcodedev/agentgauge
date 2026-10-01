"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/overview", label: "Overview" },
  { href: "/agents", label: "Agents" },
  { href: "/traces", label: "Traces" },
  { href: "/settings/api-keys", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 border-r border-ink-200 bg-white/70 px-4 py-6 backdrop-blur md:block">
      <div className="mb-8">
        <Link href="/overview" className="text-ink-950 no-underline">
          <div className="text-lg font-semibold tracking-tight">AgentGauge</div>
          <div className="mt-1 text-xs text-ink-500">Public MVP</div>
        </Link>
      </div>
      <nav className="flex flex-col gap-1" aria-label="Primary">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-2 text-sm no-underline ${
                active
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-ink-700 hover:bg-ink-100 hover:text-ink-950"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-10 rounded-md border border-ink-200 bg-ink-50 p-3 text-xs text-ink-600">
        Auth model: server-side project API key via{" "}
        <code className="font-mono">AGENTGAUGE_API_KEY</code>. Temporary for MVP.
      </div>
    </aside>
  );
}
