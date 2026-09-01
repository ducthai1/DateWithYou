"use client";

import { useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { Bike, Users } from "lucide-react";
import type { AppRouter } from "@/server/trpc/root";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { trpc } from "@/lib/trpc";
import { dateKeyFromDate, todayKey } from "@/lib/date-keys";
import { fmtDistance, fmtDuration } from "@/features/locations/format-journey";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StaggerList } from "@/components/ui/stagger-list";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type RideItem = RouterOutputs["ride"]["list"]["items"][number];

const PAGE = 30;
const MAX_ITEMS = 100; // matches the router's input cap

/** `YYYY-MM-DD` day label, same phrasing as the activity feed's day headers. */
function dayLabel(dayKey: string): string {
  if (dayKey === todayKey()) return "Hôm nay";
  if (dayKey === dateKeyFromDate(Date.now() - 24 * 60 * 60 * 1000)) return "Hôm qua";
  const label = format(parseISO(dayKey), "EEEE, d 'tháng' M, yyyy", { locale: vi });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Buckets newest-first rides into Saigon calendar days, order preserved. */
function byDay(rides: RideItem[]): { dayKey: string; rides: RideItem[] }[] {
  const days: { dayKey: string; rides: RideItem[] }[] = [];
  for (const ride of rides) {
    const dayKey = dateKeyFromDate(ride.endedAt);
    const open = days[days.length - 1];
    if (open && open.dayKey === dayKey) open.rides.push(ride);
    else days.push({ dayKey, rides: [ride] });
  }
  return days;
}

function RideHistorySkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton variant="text" className="w-28" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="border-border bg-card flex gap-3 rounded-xl border p-4">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3 rounded-md" />
            <Skeleton className="h-3 w-1/3 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Every ride the couple has finished, newest first, grouped by day like the
 * activity feed. Reads like a logbook of the road — where they went, how far,
 * how long it took, and whether they rode together — not a fleet report.
 */
export function RideHistory() {
  const [limit, setLimit] = useState(PAGE);

  const list = trpc.ride.list.useQuery(
    { limit },
    {
      // "Xem thêm" raises `limit`, which is a new query key. Without this the
      // already-loaded list would flash back to skeletons on every press.
      placeholderData: (prev) => prev,
    },
  );
  const stats = trpc.ride.stats.useQuery();

  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const days = useMemo(() => byDay(items), [items]);
  const canLoadMore = Boolean(list.data?.nextCursor) && limit < MAX_ITEMS;

  const summary = stats.data
    ? `${stats.data.count} chuyến · ${fmtDistance(stats.data.distanceMeters)}`
    : null;

  return (
    <PageShell
      className="space-y-6"
      header={
        <PageHeader
          title="Lịch sử chuyến đi"
          subtitle="Những cung đường đã đi qua cùng nhau."
          art="mapTreasure"
          banner={
            summary ? (
              <span className="bg-card/90 text-foreground inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur-md">
                {summary}
              </span>
            ) : undefined
          }
        />
      }
    >
      {list.isPending && <RideHistorySkeleton />}

      {list.isError && (
        <div
          role="alert"
          className="border-border bg-card flex flex-col items-center gap-3 rounded-xl border p-6 text-center"
        >
          <p className="font-medium">Không tải được lịch sử chuyến đi</p>
          <p className="text-muted-foreground text-sm">
            Mạng trục trặc một chút thôi, thử lại giúp mình nhé.
          </p>
          <Button
            variant="outline"
            onClick={() => void list.refetch()}
            disabled={list.isFetching}
          >
            {list.isFetching ? "Đang thử lại…" : "Thử lại"}
          </Button>
        </div>
      )}

      {list.isSuccess && items.length === 0 && (
        <EmptyState
          icon="map-pin"
          art="emptyMap"
          title="Chưa có chuyến đi nào được ghi lại"
          subtitle="Kết thúc một chuyến chỉ đường là nó tự lưu vào đây — quãng đường, thời gian và nơi đã đến."
        />
      )}

      {list.isSuccess &&
        days.map((day) => (
          <section key={day.dayKey} className="space-y-3">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {dayLabel(day.dayKey)}
            </h2>

            <StaggerList>
              {day.rides.map((ride) => (
                <Card key={ride.id} className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="bg-accent-soft flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  >
                    <Bike className="text-accent h-4 w-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <p className="min-w-0 truncate text-sm font-medium">
                        {ride.destinationName}
                      </p>
                      {/* A dedicated marker rather than folding it into the
                          summary line — "who rode" is the one fact a shared
                          keepsake list needs to call out on sight, the same
                          way the activity feed always names the actor. */}
                      {ride.companion && (
                        <span className="bg-accent-soft text-accent inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                          <Users className="h-3 w-3" aria-hidden="true" />
                          Đi cùng nhau
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {fmtDistance(ride.distanceMeters)} · {fmtDuration(ride.durationSeconds)} ·{" "}
                      {format(ride.endedAt, "HH:mm")}
                    </p>
                  </div>
                </Card>
              ))}
            </StaggerList>
          </section>
        ))}

      {list.isSuccess && canLoadMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setLimit((l) => Math.min(l + PAGE, MAX_ITEMS))}
            disabled={list.isFetching}
          >
            {list.isFetching ? "Đang tải…" : "Xem thêm"}
          </Button>
        </div>
      )}
    </PageShell>
  );
}
