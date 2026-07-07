"use client";

import { trpc } from "@/lib/trpc";
import { resolveIcon } from "@/lib/icon-registry";

/** Highlights the nearest upcoming special date with an in-app countdown. */
export function CountdownBanner() {
  const list = trpc.specialDate.list.useQuery();
  // list is sorted by daysUntil asc; first non-negative is the next event.
  const next = (list.data ?? []).find((s) => s.daysUntil >= 0);
  if (!next) return null;

  const label =
    next.daysUntil === 0
      ? `Hôm nay là ${next.title}! 🎉`
      : `Sắp tới · ${next.title}: còn ${next.daysUntil} ngày`;

  // Render via resolveIcon so the icon is always a theme-tinted Lucide SVG.
  // Legacy docs may have emoji strings — resolveIcon falls back to MapPin
  // for unrecognised values rather than crashing.
  const Icon = resolveIcon(next.icon ?? undefined);

  return (
    <div className="from-gradient-from/15 to-gradient-to/15 flex items-center gap-3 rounded-2xl bg-gradient-to-r p-3.5 shadow-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft">
        <Icon className="h-5 w-5 text-accent" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-accent text-sm font-semibold leading-snug">{label}</p>
      </div>
    </div>
  );
}
