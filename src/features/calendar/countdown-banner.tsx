"use client";

import { trpc } from "@/lib/trpc";

/** Highlights the nearest upcoming special date with an in-app countdown. */
export function CountdownBanner() {
  const list = trpc.specialDate.list.useQuery();
  // list is sorted by daysUntil asc; first non-negative is the next event.
  const next = (list.data ?? []).find((s) => s.daysUntil >= 0);
  if (!next) return null;

  const label =
    next.daysUntil === 0 ? "Hôm nay! 🎉" : `còn ${next.daysUntil} ngày`;

  return (
    <div className="from-accent-soft to-card flex items-center gap-3 rounded-2xl bg-gradient-to-r p-3.5 shadow-sm">
      <span className="text-2xl">{next.icon ?? "💞"}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{next.title}</p>
        <p className="text-accent text-sm font-semibold">{label}</p>
      </div>
    </div>
  );
}
