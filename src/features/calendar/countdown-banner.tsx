"use client";

import { trpc } from "@/lib/trpc";
import { resolveIcon } from "@/lib/icon-registry";

/**
 * Highlights the nearest upcoming special date with an in-app countdown.
 *
 * Rendered inside `PageHeader`'s `banner` slot (top-right of the artwork
 * band) instead of its own full-width strip, so it has to read as a floating
 * chip over a picture: its own translucent surface + border + blur (the same
 * treatment as other things that float over `art`), and a short label that
 * still fits inside the band's `max-w-[min(60%,22rem)]` at 360px without
 * wrapping — the old "Sắp tới · <title>: còn N ngày" sentence was sized for
 * a full-width row.
 */
export function CountdownBanner() {
  const list = trpc.specialDate.list.useQuery();
  // list is sorted by daysUntil asc; first non-negative is the next event.
  const next = (list.data ?? []).find((s) => s.daysUntil >= 0);
  if (!next) return null;

  const label =
    next.daysUntil === 0 ? `Hôm nay: ${next.title} 🎉` : `${next.title} · còn ${next.daysUntil} ngày`;

  // Render via resolveIcon so the icon is always a theme-tinted Lucide SVG.
  // Legacy docs may have emoji strings — resolveIcon falls back to MapPin
  // for unrecognised values rather than crashing.
  const Icon = resolveIcon(next.icon ?? undefined);

  return (
    <div className="bg-card/80 border-border/60 flex max-w-full items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 shadow-sm backdrop-blur-md">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft">
        <Icon className="h-3.5 w-3.5 text-accent" strokeWidth={1.8} />
      </span>
      <span className="text-accent min-w-0 truncate text-xs font-semibold leading-snug">{label}</span>
    </div>
  );
}
