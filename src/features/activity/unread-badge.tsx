"use client";

import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

/**
 * How many things the other person has added that this member has not seen.
 *
 * Reads the same watermark query the header bell uses, so the two can never
 * disagree — one number, two places that draw it.
 */
export function useUnreadActivity() {
  const q = trpc.activity.unreadCount.useQuery(undefined, {
    // A failed badge must never surface as an error: the link it decorates
    // still works. Degrade to "no badge" rather than retrying in a loop.
    retry: false,
    staleTime: 30_000,
  });
  return q.data?.count ?? 0;
}

/**
 * The count itself, as a pill.
 *
 * Capped at "9+" like the bell: past a handful the exact number stops being
 * information and starts being pressure. It is `aria-hidden` because the count
 * has to reach a screen reader through the accessible name of whatever this
 * decorates — a bare number floating in the tab order says nothing.
 */
export function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-badge text-badge-foreground pointer-events-none flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold leading-none tabular-nums shadow-sm",
        className,
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/** The words a screen reader hears in place of the pill. */
export function unreadLabel(base: string, count: number) {
  if (count <= 0) return base;
  return `${base}, ${count > 9 ? "hơn 9" : count} hoạt động mới`;
}
