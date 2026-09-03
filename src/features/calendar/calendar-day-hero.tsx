"use client";

import { motion } from "framer-motion";
import { PhotoView } from "react-photo-view";
import Link from "next/link";
import { CalendarHeart, ChevronRight, Plane, Plus, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { colorsForTags, mergeTags } from "@/lib/plan-meta";
import { resolveIcon } from "@/lib/icon-registry";
import { ToneArt } from "@/components/theme/tone-art";
import { artForDate } from "./day-art";
import { Skeleton } from "@/components/ui/skeleton";

const WD_LONG = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

function headline(key: string): { weekday: string; dayMonth: string } {
  const [y, m, d] = key.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  return { weekday: WD_LONG[dow], dayMonth: `${d} tháng ${m}` };
}

/**
 * The large "hero" card for the selected day on mobile. Leads with a memory
 * photo cover (or a warm gradient when there are none), then surfaces the
 * special-date banner, "on this day" throwbacks, a memory gallery, and the
 * day's plans. All editing delegates to the existing DayDetail sheet via
 * onOpenDay — this card is a rich, tappable summary, not a second editor.
 */
export function CalendarDayHero({
  date,
  today,
  onOpenDay,
}: {
  date: string;
  today: string;
  onOpenDay: () => void;
}) {
  const detail = trpc.calendar.dayDetail.useQuery({ date });
  const tags = trpc.space.tags.useQuery();
  const palette = tags.data ?? mergeTags(undefined);

  const { weekday, dayMonth } = headline(date);
  const isToday = date === today;

  const data = detail.data;
  const photos = (data?.memories ?? []).flatMap((m) => m.photos);
  const cover = photos[0] ?? null;
  const special = data?.specials?.[0] ?? null;
  const SpecialIcon = special ? resolveIcon(special.icon ?? undefined) : null;
  const trip = data?.trip ?? null;
  const items = data?.items ?? [];
  const doneCount = items.filter((i) => i.status === "done").length;

  return (
    <motion.div
      key={date}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="border-border bg-card overflow-hidden rounded-3xl border shadow-sm"
    >
      {/* ── Cover ── */}
      <div className="relative h-40">
        {cover ? (
          <PhotoView src={cover.url}>
            <img src={cover.url} alt="" className="h-full w-full cursor-zoom-in object-cover" />
          </PhotoView>
        ) : (
          <div className="relative h-full w-full">
            <ToneArt
              name={artForDate(date)}
              fill
              position="center 45%"
              sizes="(max-width: 768px) 100vw, 720px"
            />
            {/* Warm the picture toward the accent so an empty day still reads
                as part of this space rather than as a stock photo. */}
            <div
              className="absolute inset-0 opacity-45 mix-blend-multiply"
              style={{ background: "linear-gradient(135deg, var(--gradient-from), var(--gradient-to))" }}
            />
          </div>
        )}
        {/* Scrim so the headline stays legible over any photo. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
          <div className="min-w-0">
            <p className="text-2xl font-semibold leading-tight text-white drop-shadow-sm">{weekday}</p>
            <p className="text-sm font-medium text-white/85 drop-shadow-sm">{dayMonth}</p>
            {/* Which day of which journey. Without it the day's items read as
                an ordinary Tuesday, and "ngày 3/5" is the thing that makes the
                same list feel like being away. */}
            {trip && (
              <Link
                href={`/trips/${trip.id}`}
                className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-accent shadow-sm transition-colors hover:bg-white"
              >
                <Plane className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  Ngày {trip.day}/{trip.total} · {trip.title}
                </span>
              </Link>
            )}
          </div>
          {isToday && (
            <span className="bg-white/90 text-accent rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm">
              Hôm nay
            </span>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="space-y-3 p-4">
        {/* Special date banner */}
        {special && (
          <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-pink-100 to-rose-100 px-3 py-2.5 dark:from-pink-950/40 dark:to-rose-950/40">
            {SpecialIcon && <SpecialIcon className="h-5 w-5 shrink-0 text-pink-600" />}
            <span className="text-sm font-bold text-pink-800 dark:text-pink-200">{special.title}</span>
          </div>
        )}

        {/* On this day (past years) */}
        {data && data.onThisDay.length > 0 && (
          <div className="bg-accent-soft/50 rounded-2xl p-3">
            <p className="text-accent mb-1.5 flex items-center gap-1 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" /> Ngày này năm xưa
              <span className="text-muted-foreground font-normal">(kỷ niệm các năm trước)</span>
            </p>
            <div className="flex gap-2 overflow-x-auto">
              {data.onThisDay.map((m) => (
                <div key={m.id} className="flex shrink-0 items-center gap-1.5 text-xs">
                  {m.thumbnailUrl && (
                    <PhotoView src={m.thumbnailUrl}>
                      <img src={m.thumbnailUrl} alt="" className="h-8 w-8 cursor-zoom-in rounded-md object-cover" />
                    </PhotoView>
                  )}
                  <span className="text-foreground whitespace-nowrap">
                    {m.title} <span className="text-muted-foreground">({m.year})</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Memory gallery (the rest of the day's photos beyond the cover) */}
        {photos.length > 1 && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {photos.slice(1).map((p) => (
              <PhotoView key={p.publicId} src={p.url}>
                <img
                  src={p.url}
                  alt=""
                  className="h-20 w-20 shrink-0 cursor-zoom-in rounded-xl object-cover"
                />
              </PhotoView>
            ))}
          </div>
        )}

        {/* Plans */}
        {detail.isLoading ? (
          <Skeleton className="h-20 w-full rounded-2xl" />
        ) : items.length > 0 ? (
          <button
            type="button"
            onClick={onOpenDay}
            className="border-border hover:border-accent w-full space-y-1.5 rounded-2xl border p-3 text-left transition-colors touch-manipulation active:scale-[0.99]"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-semibold">
                {items.length} việc · {doneCount} xong
              </span>
              <ChevronRight className="text-muted-foreground h-4 w-4" />
            </div>
            {items.slice(0, 4).map((it) => {
              const color = colorsForTags(it.tags, palette)[0] ?? "var(--accent)";
              return (
                <div key={it.id} className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  {it.time && <span className="text-muted-foreground text-[11px] tabular-nums">{it.time}</span>}
                  <span className={cn("truncate text-sm", it.status === "done" && "text-muted-foreground line-through")}>
                    {it.title}
                  </span>
                </div>
              );
            })}
            {items.length > 4 && (
              <p className="text-muted-foreground pl-4 text-[11px]">+{items.length - 4} việc nữa…</p>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenDay}
            className="border-border text-muted-foreground hover:border-accent hover:text-accent flex w-full flex-col items-center gap-1 rounded-2xl border border-dashed py-6 transition-colors touch-manipulation active:scale-[0.99]"
          >
            <CalendarHeart className="h-7 w-7" strokeWidth={1.5} />
            <span className="text-sm font-medium">Chưa có gì ngày này — thêm kế hoạch nhé</span>
          </button>
        )}

        {/* Primary action */}
        <button
          type="button"
          onClick={onOpenDay}
          className="bg-accent text-accent-foreground hover:bg-accent-hover flex w-full items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-semibold shadow-sm transition-colors touch-manipulation active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" /> Thêm / sửa kế hoạch
        </button>
      </div>
    </motion.div>
  );
}
