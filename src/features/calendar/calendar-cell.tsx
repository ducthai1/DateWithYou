"use client";

import { useMemo, memo } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GridCell } from "@/lib/date-keys";
import type { DaySummary } from "@/server/trpc/routers/calendar";
import { resolveIcon } from "@/lib/icon-registry";

/* ── deterministic pseudo-random based on string ── */
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

/* ── pastel sticky-note palette (bg + text pairs) ── */
const NOTE_STYLES = [
  { bg: "#FFF9C4", text: "#5D4037" }, // yellow
  { bg: "#F8BBD0", text: "#880E4F" }, // pink
  { bg: "#B2EBF2", text: "#006064" }, // cyan
  { bg: "#C8E6C9", text: "#1B5E20" }, // green
  { bg: "#D1C4E9", text: "#4A148C" }, // lavender
  { bg: "#FFE0B2", text: "#E65100" }, // peach
  { bg: "#BBDEFB", text: "#0D47A1" }, // sky blue
  { bg: "#F0F4C3", text: "#827717" }, // lime
];

/* ── pin colours ── */
const PIN_BG = ["#E53935", "#1E88E5", "#43A047", "#FB8C00", "#8E24AA"];

/* ── pre-computed positions for up to 3 notes scattered inside a cell ─
 *  Each entry is [top%, left%, rotation°].
 *  We pick from several layout presets based on the date hash so every
 *  day looks a little different.  */
const LAYOUTS: [number, number, number][][] = [
  [[25, 10, -4], [40, 35, 3], [20, 55, -2]],
  [[18, 5, 2],  [38, 30, -5], [55, 50, 4]],
  [[20, 8, -3], [15, 48, 5],  [50, 25, -1]],
  [[22, 40, 3], [45, 8, -4],  [48, 50, 2]],
  [[18, 15, -2],[35, 45, 4],  [55, 10, -3]],
  [[22, 15, 3], [30, 38, -3], [45, 20, 1]],
];

/** One day cell in the month grid – sticky-note style. */
export const CalendarCell = memo(function CalendarCell({
  cell,
  summary,
  isToday,
  onClick,
}: {
  cell: GridCell;
  summary?: DaySummary;
  isToday: boolean;
  onClick: () => void;
}) {
  const count = summary?.planCount ?? 0;
  const hasPlans = summary?.plans && summary.plans.length > 0;
  const hasSpecial = !!summary?.special;

  // Mobile shows compact colored dots instead of sticky notes (legibility).
  // Dots convey activity variety; the top-right badge conveys quantity.
  const tagColors = summary?.tagColors;
  const plans = summary?.plans;
  const dotColors = useMemo(() => {
    const fromTags = tagColors ?? [];
    if (fromTags.length) return fromTags.slice(0, 4);
    const fromPlans = (plans ?? []).map((p) => p.color).filter(Boolean);
    if (fromPlans.length) return Array.from(new Set(fromPlans)).slice(0, 4);
    return count > 0 ? ["var(--accent)"] : [];
  }, [tagColors, plans, count]);
  // Mirror desktop notes: dim the dot row when every plan that day is done.
  const allDone = count > 0 && (summary?.doneCount ?? 0) >= count;

  // pick a layout for this cell based on the date — stable per cell.key
  const dayHash = useMemo(() => hash(cell.key), [cell.key]);
  const layout = LAYOUTS[dayHash % LAYOUTS.length];

  // Resolve Lucide icon for special date
  const SpecialIcon = hasSpecial ? resolveIcon(summary!.special!.icon ?? undefined) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        `Ngày ${cell.day}` +
        (isToday ? ", hôm nay" : "") +
        (count > 0 ? `, ${count} việc` : "") +
        (hasSpecial ? `, ${summary!.special!.title}` : "")
      }
      className={cn(
        // Mobile: soft borderless tile with tap feedback. Desktop (md+): the
        // original bordered square with hover + sticky-note layout is restored.
        "relative flex aspect-square flex-col items-start justify-start overflow-hidden p-1 md:p-2 text-sm transition-all touch-manipulation",
        "rounded-2xl md:rounded-xl md:border-2 md:transition-colors",
        cell.inMonth && !hasSpecial &&
          "bg-card shadow-sm active:scale-[0.96] md:shadow-none md:border-border md:hover:border-accent md:active:scale-100",
        cell.inMonth && hasSpecial &&
          "bg-pink-50 shadow-sm active:scale-[0.96] md:bg-card md:shadow-none md:border-pink-300 md:active:scale-100 dark:md:border-pink-700",
        !cell.inMonth &&
          "bg-transparent text-muted-foreground/40 md:border-transparent",
        // Today: accent border on desktop; mobile uses the circled number.
        isToday && "md:border-accent",
      )}
    >
      {/* Soft radial glow background for special dates */}
      {hasSpecial && cell.inMonth && (
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 50% 50%, rgba(244,114,182,0.12) 0%, transparent 70%)",
          }}
        />
      )}

      {/* Background memory thumbnail. Mobile shows it almost fully (reads as a
          real photo of the day) with a soft top scrim so the date stays legible;
          desktop keeps the faint 25% wash behind the sticky notes. */}
      {summary?.thumbnailUrl && cell.inMonth && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={summary.thumbnailUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-90 md:opacity-25"
          />
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-card via-card/40 to-transparent md:hidden" />
        </>
      )}

      {/* ── Top row: day number + count badge ── */}
      <div className="relative flex w-full items-start justify-between z-20">
        <div className="flex items-center gap-1">
          {/* Mobile today = filled accent disc around the number; desktop keeps
              the plain accent-coloured number (today ring is on the cell). */}
          <span
            className={cn(
              "leading-none",
              isToday
                ? "flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-accent-foreground shadow-sm md:h-auto md:w-auto md:rounded-none md:bg-transparent md:font-medium md:text-accent md:shadow-none"
                : "font-medium",
            )}
          >
            {cell.day}
          </span>
          {summary && summary.memoryCount > 0 && !summary.thumbnailUrl && (
            <span className="h-1.5 w-1.5 rounded-full bg-stone-400" title="Kỷ niệm" />
          )}
        </div>
        {/* Mobile special-date marker: a small filled heart (the desktop ribbon
            below is hidden on mobile). Count badge takes priority when present. */}
        {count > 0 ? (
          <span className="bg-accent text-accent-foreground flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none shadow-sm md:h-4 md:min-w-4">
            {count}
          </span>
        ) : (
          hasSpecial && (
            <Heart className="h-3.5 w-3.5 shrink-0 fill-pink-400 text-pink-400 md:hidden" />
          )
        )}
      </div>

      {/* ── Special date ribbon (desktop only; mobile uses the heart badge) ── */}
      {hasSpecial && SpecialIcon && (
        <div className="relative z-20 mt-0.5 hidden w-full md:block">
          <div
            className="flex items-center gap-1 rounded-md px-1.5 py-[3px] shadow-sm"
            style={{
              background: "linear-gradient(135deg, #FCE4EC 0%, #F8BBD0 50%, #F48FB1 100%)",
            }}
          >
            <SpecialIcon className="w-3 h-3 text-pink-600 shrink-0" />
            <span className="text-[8px] sm:text-[9px] font-bold text-pink-800 truncate leading-tight">
              {summary!.special!.title}
            </span>
          </div>
        </div>
      )}

      {/* ── Sticky notes scattered in the cell ── */}
      {hasPlans &&
        summary.plans.slice(0, 2).map((p, i) => {
          const noteHash = hash(p.title + cell.key + i);
          const style = NOTE_STYLES[noteHash % NOTE_STYLES.length];
          const pin = PIN_BG[noteHash % PIN_BG.length];
          const [top, left, rot] = layout[i] ?? layout[0];
          const extraRot = (noteHash % 7) - 3;
          const finalRot = rot + extraRot;

          return (
            <div
              key={i}
              className={cn(
                "absolute z-10 hidden flex-col items-center transition-transform duration-200 hover:z-30 hover:scale-110 md:flex",
                p.done && "opacity-50",
              )}
              style={{
                top: `${top}%`,
                left: `${left}%`,
                width: "48%",
                transform: `rotate(${finalRot}deg)`,
              }}
            >
              {/* The pin */}
              <div
                className="relative -mb-[4px] z-20 w-[7px] h-[7px] sm:w-[8px] sm:h-[8px] rounded-full shrink-0"
                style={{
                  backgroundColor: pin,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.5), inset 0 -1px 2px rgba(255,255,255,0.35)",
                }}
              />

              {/* The note */}
              <div
                className="w-full rounded-[2px] px-1 py-[3px] sm:py-1"
                style={{
                  backgroundColor: style.bg,
                  color: style.text,
                  boxShadow: "2px 3px 6px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.12)",
                  backgroundImage: "linear-gradient(135deg, transparent 70%, rgba(0,0,0,0.04) 100%)",
                }}
              >
                <div
                  className={cn(
                    "text-[8px] sm:text-[9px] font-bold leading-[1.2] truncate",
                    p.done && "line-through",
                  )}
                  style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
                >
                  {p.title}
                </div>
              </div>
            </div>
          );
        })}

      {/* Extra count indicator (desktop sticky-note overflow) */}
      {hasPlans && summary.planCount > 2 && (
        <div className="absolute bottom-1 right-1 z-20 hidden text-[8px] sm:text-[9px] font-bold text-muted-foreground/80 bg-card/70 rounded-full px-1.5 py-0.5 backdrop-blur-sm shadow-sm border border-border/50 md:block">
          +{summary.planCount - 2}
        </div>
      )}

      {/* Mobile: compact colored dots (sticky notes are desktop-only). A thin
          white ring keeps them legible when they sit over a photo thumbnail. */}
      {cell.inMonth && dotColors.length > 0 && (
        <div className={cn("absolute inset-x-0 bottom-1.5 z-20 flex items-center justify-center gap-1 md:hidden", allDone && "opacity-50")}>
          {dotColors.map((c, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full ring-1 ring-white/70"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
    </button>
  );
});
