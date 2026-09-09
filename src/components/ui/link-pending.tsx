"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

/**
 * The instant answer to a tap that is going to change screen.
 *
 * Every screen in this app is server-rendered per request (the root layout
 * reads the theme and tone cookies), so a tap on a card is followed by a round
 * trip before anything moves — measured at 207–298ms from a desktop on fibre,
 * and the better part of a second on a phone. People press again, and again,
 * thinking the first press missed.
 *
 * Lived in `features/blog/` first, where the problem was noticed. It is not a
 * blog problem, so it moved here — the trip cards and the library posters have
 * exactly the same tap and now use the same answer.
 */
export function PendingOverlay({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Đang mở…"
      className={`bg-card/70 pointer-events-none absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[1px] ${className}`}
    >
      <span className="bg-card text-accent flex h-10 w-10 items-center justify-center rounded-full shadow-md">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      </span>
    </span>
  );
}

/**
 * The overlay, wired to the enclosing `<Link>`'s own pending state.
 *
 * MUST sit INSIDE the `<Link>` — that is how `useLinkStatus` finds which
 * navigation it belongs to — and the link needs `relative`, since the overlay
 * fills it. For a tap that calls `router.push` instead of following a link,
 * drive `PendingOverlay` from `useTransition`'s `isPending`.
 */
export function LinkPending({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <PendingOverlay className={className} />;
}
