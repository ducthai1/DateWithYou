"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, NAV_HIDDEN_ON } from "./nav-items";
import { cn } from "@/lib/utils";

/** Mobile-only bottom nav (hidden on md+, where the sidebar takes over). The
 *  center item ("Hôm nay") is raised into a floating accent disc as the app's
 *  hub. Items flagged `mobileHidden` are dropped here — six targets is the most
 *  this bar fits at 390px — and stay reachable from the sidebar and top bar. */
export function BottomNav() {
  const pathname = usePathname();
  if (NAV_HIDDEN_ON.includes(pathname)) return null;

  return (
    <nav data-app-chrome
      className="fixed inset-x-0 bottom-0 z-40 flex items-end justify-around border-t border-white/40 bg-white/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl shadow-[0_-10px_40px_rgba(0,0,0,0.04)] md:hidden">
      {NAV_ITEMS.filter((it) => !it.mobileHidden).map((it) => {
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
                  "ring-background flex h-14 w-14 items-center justify-center rounded-full shadow-lg ring-4 transition-all duration-200 active:scale-90 active:shadow-xl",
                  active
                    ? "bg-accent text-accent-foreground shadow-accent/30"
                    : "bg-accent/90 text-accent-foreground",
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
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition-colors",
              active ? "text-accent" : "text-muted-foreground",
            )}
          >
            {/* Icon sits in a pill that fills with accent-soft when active — a
                clearer "you are here" cue than colour alone, and it animates. */}
            <span
              className={cn(
                "flex h-8 w-9 items-center justify-center rounded-full transition-all duration-200 active:scale-90",
                active ? "bg-accent-soft scale-100" : "scale-95",
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
