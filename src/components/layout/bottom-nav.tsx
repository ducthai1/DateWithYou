"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, NAV_HIDDEN_ON } from "./nav-items";
import { cn } from "@/lib/utils";

/** Mobile-only bottom nav (hidden on md+, where the sidebar takes over). The
 *  center item (Lịch) is raised into a floating accent disc as the app's hub. */
export function BottomNav() {
  const pathname = usePathname();
  if (NAV_HIDDEN_ON.includes(pathname)) return null;

  return (
    <nav className="border-border bg-background/90 fixed inset-x-0 bottom-0 z-20 flex items-end justify-around border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {NAV_ITEMS.map((it) => {
        const active = pathname.startsWith(it.href);
        const Icon = it.Icon;

        if (it.center) {
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-label={it.label}
              className="relative -top-3 flex flex-1 flex-col items-center"
            >
              <span
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full shadow-lg ring-4 ring-background transition-transform active:scale-95",
                  active ? "bg-accent text-accent-foreground" : "bg-accent/90 text-accent-foreground",
                )}
              >
                <Icon className="h-6 w-6" />
              </span>
              <span className={cn("mt-0.5 text-[11px]", active ? "text-accent" : "text-muted-foreground")}>
                {it.label}
              </span>
            </Link>
          );
        }

        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px]",
              active ? "text-accent" : "text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
