"use client";

import { Clock, MapPin, RefreshCw, Star, Trash2, Utensils, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** đ, grouped — "180.000đ" rather than a bare number nobody can read at a glance. */
export function money(v: number): string {
  return `${Math.round(v).toLocaleString("vi-VN")}đ`;
}

export function moneyBand(band: { min: number; max: number }): string {
  return band.min === band.max ? money(band.max) : `${money(band.min)}–${money(band.max)}`;
}

export function walkLabel(m: number | null): string | null {
  if (m == null) return null;
  if (m < 950) return `${Math.round(m / 10) * 10}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

export type StopView = {
  kind: string;
  startTime: string;
  title: string;
  reason: string;
  unfilled: boolean;
  travelM: number | null;
  cost: { min: number; max: number };
  warnings: string[];
  category: string | null;
  district: string | null;
  rating: number | null;
  mustTry: string | null;
  suggestion: { externalId: string } | null;
  alternatives: unknown[];
};

/**
 * One stop on the day.
 *
 * The card has to answer, without being opened: when, where, why this place,
 * how far from the last one, and roughly what it costs. "Why" is the one that
 * earns trust — a list of places is a search result, a list of places with
 * reasons is a plan.
 */
export function PlanStopCard({
  stop,
  index,
  onSwap,
  onDrop,
  canSwap,
}: {
  stop: StopView;
  index: number;
  onSwap: () => void;
  onDrop: () => void;
  canSwap: boolean;
}) {
  const walk = walkLabel(stop.travelM);
  return (
    <div className="relative pl-10">
      {/* The spine of the timeline, and this stop's bead on it. */}
      <span
        aria-hidden
        className="bg-border absolute left-[13px] top-0 h-full w-px"
        style={index === 0 ? { top: "1.25rem" } : undefined}
      />
      <span
        aria-hidden
        className="border-accent bg-card absolute left-0 top-3 flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold"
      >
        {index + 1}
      </span>

      <Card
        className={cn(
          "flex flex-col gap-2",
          stop.unfilled && "border-dashed bg-muted/30",
          stop.suggestion && "border-sky-400/60 bg-sky-50/40 dark:bg-sky-950/20",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-muted-foreground flex items-center gap-1 text-xs font-semibold tabular-nums">
              <Clock className="h-3 w-3" aria-hidden />
              {stop.startTime}
            </p>
            <p className="mt-0.5 truncate font-semibold leading-tight">
              {stop.unfilled ? "Chưa tìm được chỗ cho khung này" : stop.title}
            </p>
          </div>
          {stop.suggestion && (
            <span className="shrink-0 rounded-full border border-sky-400/50 bg-sky-100/70 px-2 py-0.5 text-[10px] font-semibold leading-none text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
              Gợi ý mới
            </span>
          )}
        </div>

        {!stop.unfilled && (
          <>
            <p className="text-muted-foreground text-sm">{stop.reason}</p>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {stop.district && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" aria-hidden />
                  {stop.district}
                </span>
              )}
              {walk && (
                <span className="tabular-nums">
                  {/* There is no stop before the first one: that distance is
                      measured from where the person actually is. */}
                  {index === 0 ? "cách bạn" : "cách chặng trước"} ~{walk}
                </span>
              )}
              <span className="flex items-center gap-1 tabular-nums">
                <Wallet className="h-3 w-3" aria-hidden />
                {moneyBand(stop.cost)}
              </span>
              {stop.rating != null && (
                <span className="flex items-center gap-1 text-amber-500">
                  <Star className="h-3 w-3 fill-current" aria-hidden />
                  {stop.rating}
                </span>
              )}
              {stop.mustTry && (
                <span className="flex items-center gap-1">
                  <Utensils className="h-3 w-3" aria-hidden />
                  {stop.mustTry}
                </span>
              )}
            </div>
            {stop.warnings.map((w) => (
              <p key={w} className="text-amber-600 text-xs">
                {w}
              </p>
            ))}
          </>
        )}

        <div className="border-border/70 mt-1 flex items-center gap-1 border-t pt-2 text-xs">
          <button
            type="button"
            onClick={onSwap}
            disabled={!canSwap}
            className="text-accent hover:bg-accent-soft disabled:text-muted-foreground/50 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 font-medium transition-colors disabled:hover:bg-transparent"
            style={{ minHeight: 36 }}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Đổi chặng này
          </button>
          <button
            type="button"
            onClick={onDrop}
            className="text-muted-foreground hover:bg-muted ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors"
            style={{ minHeight: 36 }}
            aria-label={`Bỏ chặng ${index + 1}`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Bỏ
          </button>
        </div>
      </Card>
    </div>
  );
}
