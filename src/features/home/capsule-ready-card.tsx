"use client";

// Top of the screen when it appears: a time capsule whose unlock date has
// arrived and that nobody has opened yet. This is the whole reason the "Hôm
// nay" screen exists — something is waiting, and it took zero effort to find.

import Link from "next/link";
import { Hourglass, ChevronRight } from "lucide-react";
import { HomeSection } from "./home-section";

export type CapsuleReady = {
  id: string;
  title: string;
  /** Resolved server-side — the client never needs a second identity query. */
  fromSelf: boolean;
  unlockDate: Date;
};

export function CapsuleReadyCard({ capsules }: { capsules: CapsuleReady[] }) {
  if (capsules.length === 0) return null;

  const title =
    capsules.length === 1
      ? "Có một hộp thời gian vừa mở khoá"
      : `Có ${capsules.length} hộp thời gian đang chờ`;

  return (
    <HomeSection Icon={Hourglass} title={title} highlight>
      <ul className="space-y-2">
        {capsules.map((c) => (
          <li key={c.id} className="border-border/70 bg-card/70 rounded-xl border px-3 py-2.5">
            <p className="truncate text-sm font-medium">{c.title}</p>
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              {c.fromSelf
                ? "Bạn viết, để dành cho hôm nay"
                : "Người kia để lại cho bạn"}
            </p>
          </li>
        ))}
      </ul>

      <Link
        href="/vault"
        className="bg-accent text-accent-foreground hover:bg-accent-hover focus-visible:ring-ring/50 inline-flex h-11 w-full items-center justify-center gap-1 rounded-xl text-sm font-medium shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        Mở ra xem
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </HomeSection>
  );
}
