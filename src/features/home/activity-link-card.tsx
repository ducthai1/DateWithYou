"use client";

// Deliberately the quietest thing on the screen: a single row out to the
// activity feed. It is a "if you're curious" affordance, not a notification —
// no counts, no badges, nothing that turns checking on each other into a habit.

import Link from "next/link";
import { Footprints, ChevronRight } from "lucide-react";

export function ActivityLinkCard() {
  return (
    <Link
      href="/activity"
      className="border-border bg-card hover:bg-muted focus-visible:ring-ring/50 flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3 outline-none transition-colors focus-visible:ring-2"
    >
      <span
        className="bg-accent-soft flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        aria-hidden="true"
      >
        <Footprints className="text-accent h-4 w-4" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">Xem người ấy vừa làm gì</span>
        <span className="text-muted-foreground block text-xs">
          Những gì hai đứa vừa thêm vào, gần đây nhất
        </span>
      </span>
      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden="true" />
    </Link>
  );
}
