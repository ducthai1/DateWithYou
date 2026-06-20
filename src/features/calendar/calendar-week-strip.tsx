"use client";

import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DaySummary } from "@/server/trpc/routers/calendar";

const WD = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]; // Monday-first

/**
 * Horizontally swipeable 7-day strip for the mobile calendar. Each pill shows
 * the weekday, the date (today = filled accent disc, selected = ringed), and a
 * compact indicator row (special-date heart + tag-coloured activity dots).
 * Swiping left/right pages the week via onSwipe; tapping a day selects it.
 */
export function CalendarWeekStrip({
  weekDays,
  selected,
  today,
  summary,
  onSelect,
  onSwipe,
}: {
  weekDays: string[];
  selected: string;
  today: string;
  summary: Record<string, DaySummary>;
  onSelect: (key: string) => void;
  onSwipe: (dir: 1 | -1) => void;
}) {
  return (
    <motion.div
      // Re-mount per week so the new week subtly fades in after a swipe.
      key={weekDays[0]}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.18}
      onDragEnd={(_, info) => {
        if (info.offset.x < -50) onSwipe(1);
        else if (info.offset.x > 50) onSwipe(-1);
      }}
      style={{ touchAction: "pan-y" }}
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
      className="grid grid-cols-7 gap-1"
    >
      {weekDays.map((key, i) => {
        const day = Number(key.slice(8, 10));
        const s = summary[key];
        const isToday = key === today;
        const isSel = key === selected;
        const dots = (s?.tagColors ?? []).slice(0, 3);
        const hasPlans = (s?.planCount ?? 0) > 0;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            aria-label={`Ngày ${day}`}
            aria-pressed={isSel}
            className={cn(
              "relative flex flex-col items-center gap-1 rounded-2xl py-2 transition-all touch-manipulation active:scale-95",
              isSel ? "bg-accent-soft ring-accent shadow-sm ring-2" : "active:bg-muted",
            )}
          >
            <span className={cn("text-[10px] font-semibold", i >= 5 ? "text-accent/70" : "text-muted-foreground")}>
              {WD[i]}
            </span>
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors",
                isToday
                  ? "bg-accent text-accent-foreground shadow"
                  : isSel
                    ? "text-accent"
                    : "text-foreground",
              )}
            >
              {day}
            </span>
            {/* Indicator row — fixed height so pills stay aligned when empty. */}
            <span className="flex h-2 items-center justify-center gap-0.5">
              {s?.special && (
                <Heart
                  className="h-2.5 w-2.5 fill-pink-400 text-pink-400"
                  aria-label="Ngày đặc biệt"
                />
              )}
              {dots.map((c, di) => (
                <span key={di} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />
              ))}
              {!s?.special && dots.length === 0 && hasPlans && (
                <span className="bg-accent h-1.5 w-1.5 rounded-full" />
              )}
            </span>
          </button>
        );
      })}
    </motion.div>
  );
}
