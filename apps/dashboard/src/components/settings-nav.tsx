"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/settings/api-keys", label: "API keys" },
  { href: "/settings/model-pricing", label: "Model pricing" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className="mb-5 border-b border-line">
      <div className="-mb-px flex gap-6" role="tablist">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              role="tab"
              aria-selected={active}
              className={`border-b-2 px-1 py-2 text-sm font-medium no-underline ${
                active
                  ? "border-fg text-fg"
                  : "border-transparent text-secondary hover:border-line hover:text-fg"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
