"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, NAV_HIDDEN_ON } from "./nav-items";
import { UnreadBadge, unreadLabel, useUnreadActivity } from "@/features/activity/unread-badge";
import { cn } from "@/lib/utils";

/** Mobile-only bottom nav (hidden on md+, where the sidebar takes over). The
 *  center item ("Hôm nay") is raised into a floating accent disc as the app's
 *  hub. Items flagged `mobileHidden` are dropped here — six targets is the most
 *  this bar fits at 390px — and stay reachable from the sidebar and top bar. */
export function BottomNav() {
  const pathname = usePathname();
  const unreadActivity = useUnreadActivity();
  if (NAV_HIDDEN_ON.includes(pathname)) return null;

  return (
    <nav data-app-chrome
      // z-48: above every piece of page content that can float over it —
      // notably /map's saved-place sheet (z-45), which used to sit at z-50
      // and rode over this bar at its taller stops. Left below z-50 on
      // purpose: that tier is full-screen takeovers (the in-app turn-by-turn
      // overlay, its own floating stop/pause buttons) and toast-style
      // banners anchored a few pixels above the very bottom of the screen —
      // going higher than those would let this bar's full-width links steal
      // taps meant for controls sharing that same strip.
      className="fixed inset-x-0 bottom-0 z-[48] flex items-end justify-around border-t border-white/40 bg-white/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl shadow-[0_-10px_40px_rgba(0,0,0,0.04)] md:hidden">
      {NAV_ITEMS.filter((it) => !it.mobileHidden).map((it) => {
        // Only Hoạt động carries a count; the badge renders nothing for 0.
        const unread = it.href === "/activity" ? unreadActivity : 0;
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
            aria-label={unread > 0 ? unreadLabel(it.label, unread) : undefined}
            className={cn(
              // min-w-0 so a long label cannot widen its own column and shove
              // the rest of the bar sideways: seven targets on a 360px screen
              // leave about 51px each, and "Bộ sưu tập" is wider than that.
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 transition-colors",
              "text-[10px] leading-tight",
              active ? "text-accent" : "text-muted-foreground",
            )}
          >
            {/* Icon sits in a pill that fills with accent-soft when active — a
                clearer "you are here" cue than colour alone, and it animates. */}
            <span
              className={cn(
                "relative flex h-8 w-9 items-center justify-center rounded-full transition-all duration-200 active:scale-90",
                active ? "bg-accent-soft scale-100" : "scale-95",
              )}
            >
              <Icon className="h-5 w-5" />
              <UnreadBadge count={unread} className="absolute -right-1 -top-0.5" />
            </span>
            {/* Truncated rather than wrapped: two lines would make this row
                taller than the raised centre disc and the bar would look bent. */}
            <span className="w-full truncate px-0.5 text-center">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
