"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, NAV_HIDDEN_ON } from "./nav-items";

/** Mobile-only bottom nav (hidden on md+, where the sidebar takes over). */
export function BottomNav() {
  const pathname = usePathname();
  if (NAV_HIDDEN_ON.includes(pathname)) return null;

  return (
    <nav className="border-border bg-background/90 fixed inset-x-0 bottom-0 z-20 flex justify-around border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {NAV_ITEMS.map((it) => {
        const active = pathname.startsWith(it.href);
        const Icon = it.Icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
              active ? "text-accent" : "text-muted-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
