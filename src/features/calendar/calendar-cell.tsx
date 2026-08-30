"use client";

import { useMemo, memo } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GridCell } from "@/lib/date-keys";
import type { DaySummary } from "@/server/trpc/routers/calendar";
import { resolveIcon } from "@/lib/icon-registry";
import { ToneArt } from "@/components/theme/tone-art";
import { artForDate, hashKey } from "./day-art";

/* ── deterministic pseudo-random based on string ── */
// Layout scatter and artwork both key off the same date hash — see day-art.
const hash = hashKey;

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

/* ── faint default artwork for cells with no photo memory ──────────────────
 *  Restricted to the five pieces that exist in BOTH tones (src/lib/tone.ts)
 *  so the picture always matches the active morning/afternoon palette
 *  instead of silently falling back to the other tone's colours the way an
 *  afternoon-only piece would under the morning tone. */
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
  // Same date-derived hash picks the background artwork, so a month never
  // reshuffles its pictures on re-render or when navigating away and back.
  const artName = artForDate(cell.key);

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
        //
        // aspect-square ties height to width unconditionally now. Two earlier
        // attempts both got this wrong in opposite directions: a viewport-height
        // clamp (clamp(3.25rem,11vh,7rem)) forced ~99–112px-tall cells against a
        // ~185px-wide column at an ordinary 1440x900; the `short`/`shorter`
        // variants that replaced it (max-height:760px/620px, globals.css) fire
        // on completely everyday laptop windows, not just zoomed-in ones —
        // measured, 1440x740 and 1280x720 both collapsed a 153px/130px-wide
        // square cell to a 52px-tall sliver (ratio ~2.5–2.9). The calendar's
        // container is `max-w-[1400px]` (calendar-view.tsx), so a square cell
        // can never exceed roughly 188px tall regardless of screen width —
        // there is no wide-but-short blow-up left to guard against, only a
        // taller page. A six-week month of square cells doesn't fit under
        // ~1100px of viewport height and the page scrolls; square cells are
        // what was asked for twice, so scrolling is the accepted trade-off.
        "relative flex aspect-square flex-col items-start justify-start overflow-hidden p-1 md:p-3 text-sm transition-all touch-manipulation",
        "rounded-2xl md:rounded-xl md:transition-colors",
        cell.inMonth && !isToday && "md:border-[3px]",
        cell.inMonth && !isToday && !hasSpecial && "bg-card shadow-sm active:scale-[0.96] md:shadow-none md:border-border md:hover:border-accent md:active:scale-100",
        cell.inMonth && !isToday && hasSpecial && "bg-pink-50 shadow-sm active:scale-[0.96] md:bg-card md:shadow-none md:border-pink-300 md:active:scale-100 dark:md:border-pink-700",
        cell.inMonth && isToday &&
          "bg-accent/15 border-[3px] border-accent shadow-sm active:scale-[0.96] md:shadow-none md:active:scale-100",
        !cell.inMonth &&
          "bg-card/45 text-muted-foreground/60 md:border-transparent md:border-[3px]",
      )}
    >
      {/* Faint default artwork so an empty day (no plans, no memory photo) is
          not a blank card. The real memory thumbnail below already does this
          job at much higher opacity, so it wins when both would apply.
          Skipped outside the current month — those cells are already dimmed
          to read as "not really part of this view", and a crisp image there
          would fight that. sizes="190px" matches the measured cell width
          across every desktop breakpoint (98px at a 768px-wide viewport up
          to 188px at 1920px, bounded by the grid's own max-w-[1400px]), so
          next/image serves its 256w bucket — the smallest built-in size
          above 190px — instead of ToneArt's 720w/100vw default, which would
          be a wasteful fetch repeated 35-42 times a month. */}
      {cell.inMonth && !summary?.thumbnailUrl && (
        <ToneArt name={artName} fill sizes="190px" className="z-0 opacity-[0.16] pointer-events-none" />
      )}

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
          { }
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
        <div className="min-w-0 flex items-center gap-1">
          {/* Today gets a solid filled circle around the number on all devices */}
          <span
            className={cn(
              "leading-none",
              isToday
                ? "flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[14px] font-bold text-accent-foreground shadow-sm"
                : "font-semibold pt-1 pl-1",
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
          <span className="bg-accent text-accent-foreground flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none shadow-sm md:h-4 md:min-w-4">
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
