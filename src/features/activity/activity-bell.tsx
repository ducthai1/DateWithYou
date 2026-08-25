"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

/**
 * Header entry point to /activity with an unread badge.
 *
 * The number is capped at "9+": past a handful the exact count stops being
 * information and starts being pressure, and at n=2 nobody is counting.
 */
export function ActivityBell({ className }: { className?: string }) {
  const unread = trpc.activity.unreadCount.useQuery(undefined, {
    // A failed badge must never become a visible error — the bell still works
    // as a plain link, so degrade quietly instead of retrying in a loop.
    retry: false,
    staleTime: 30_000,
  });

  const count = unread.data?.count ?? 0;
  const overflow = count > 9;
  const badgeText = overflow ? "9+" : String(count);

  // The badge is a glyph, so the count has to reach screen readers through the
  // link's own name instead.
  const label =
    count > 0
      ? `Hoạt động, ${overflow ? "hơn 9" : count} hoạt động mới`
      : "Hoạt động";

  return (
    <Link
      href="/activity"
      aria-label={label}
      className={cn(
        "text-muted-foreground hover:bg-muted active:bg-muted relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors touch-manipulation",
        "focus-visible:ring-ring/50 outline-none focus-visible:ring-2",
        className,
      )}
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className={cn(
            "bg-accent text-accent-foreground absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none",
          )}
        >
          {badgeText}
        </span>
      )}
    </Link>
  );
}
