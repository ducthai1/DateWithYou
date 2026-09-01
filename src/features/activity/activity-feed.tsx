"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { inferRouterOutputs } from "@trpc/server";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import {
  CalendarHeart,
  Gift,
  Hourglass,
  Images,
  Library,
  MapPin,
  Plane,
  Star,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { AppRouter } from "@/server/trpc/root";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { trpc } from "@/lib/trpc";
import { dateKeyFromDate, todayKey } from "@/lib/date-keys";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StaggerList } from "@/components/ui/stagger-list";
import { useToast } from "@/components/ui/toast";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type FeedItem = RouterOutputs["activity"]["feed"]["items"][number];
type Member = RouterOutputs["space"]["members"][number];

const PAGE = 30;
const MAX_ITEMS = 100; // matches the router's input cap
const SIXTY_MIN_MS = 60 * 60 * 1000;

/** Verb + noun per kind. Vietnamese nouns don't inflect, so one form covers both. */
const KIND_META: Record<FeedItem["kind"], { icon: LucideIcon; verb: string; noun: string }> = {
  memory: { icon: Images, verb: "đã thêm", noun: "kỷ niệm" },
  location: { icon: MapPin, verb: "đã lưu", noun: "địa điểm" },
  plan: { icon: CalendarHeart, verb: "đã thêm", noun: "việc trong lịch" },
  trip: { icon: Plane, verb: "đã lên", noun: "chuyến đi" },
  capsule: { icon: Hourglass, verb: "đã gửi", noun: "hộp thời gian" },
  wishlist: { icon: Gift, verb: "đã thêm", noun: "món trong wishlist" },
  media: { icon: Library, verb: "đã lưu", noun: "mục trong bộ sưu tập" },
  roadmap: { icon: Target, verb: "đã thêm", noun: "dự định" },
  specialDate: { icon: Star, verb: "đã đánh dấu", noun: "ngày đặc biệt" },
};

type Burst = {
  key: string;
  kind: FeedItem["kind"];
  actorId: string;
  /** Newest instant in the burst — what the relative timestamp shows. */
  createdAt: Date;
  items: FeedItem[];
};

/**
 * Collapses CONSECUTIVE items by the same person, of the same kind, inside a
 * 60-minute window into one entry ("Người kia đã thêm 3 kỷ niệm").
 *
 * One sitting of "add five places we want to try" is one thing that happened,
 * not five. There is no "và N người khác" variant anywhere in this file on
 * purpose: the space holds exactly two people, so the other party is always
 * fully named.
 *
 * `items` must be newest-first, which is the order the router returns.
 */
function collapse(items: FeedItem[]): Burst[] {
  const bursts: Burst[] = [];
  for (const item of items) {
    const open = bursts[bursts.length - 1];
    const withinWindow =
      open && open.createdAt.getTime() - item.createdAt.getTime() <= SIXTY_MIN_MS;
    if (open && withinWindow && open.actorId === item.actorId && open.kind === item.kind) {
      open.items.push(item);
      continue;
    }
    bursts.push({
      key: item.id,
      kind: item.kind,
      actorId: item.actorId,
      createdAt: item.createdAt,
      items: [item],
    });
  }
  return bursts;
}

/** Buckets newest-first items into Saigon calendar days, order preserved. */
function byDay(items: FeedItem[]): { dayKey: string; bursts: Burst[] }[] {
  const days: { dayKey: string; items: FeedItem[] }[] = [];
  for (const item of items) {
    const dayKey = dateKeyFromDate(item.createdAt);
    const open = days[days.length - 1];
    if (open && open.dayKey === dayKey) open.items.push(item);
    else days.push({ dayKey, items: [item] });
  }
  return days.map((d) => ({ dayKey: d.dayKey, bursts: collapse(d.items) }));
}

function dayLabel(dayKey: string): string {
  if (dayKey === todayKey()) return "Hôm nay";
  if (dayKey === dateKeyFromDate(Date.now() - 24 * 60 * 60 * 1000)) return "Hôm qua";
  // parseISO on the day key (not on createdAt) so the header always names the
  // day the item was bucketed into.
  const label = format(parseISO(dayKey), "EEEE, d 'tháng' M, yyyy", { locale: vi });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function ActorAvatar({ member }: { member?: Member }) {
  const initial = (member?.name ?? "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden="true"
      className="bg-accent-soft text-accent border-border flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold"
      // The couple picks these colours themselves — it is stored data, not a
      // hard-coded palette, so it is safe to ring the avatar with it.
      style={member?.avatarColor ? { borderColor: member.avatarColor } : undefined}
    >
      {member?.avatarEmoji || initial}
    </span>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton variant="text" className="w-28" />
      {[0, 1, 2, 3].map((i) => (
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
 * The derived activity feed. Marks itself seen on mount — opening the screen
 * IS the read receipt, so the badge clears without asking for a second action.
 */
export function ActivityFeed() {
  const toast = useToast();
  const utils = trpc.useUtils();
  const [limit, setLimit] = useState(PAGE);

  const list = trpc.activity.feed.useQuery(
    { limit },
    {
      // "Xem thêm" raises `limit`, which is a new query key. Without this the
      // already-read feed would be replaced by skeletons on every press.
      placeholderData: (prev) => prev,
    },
  );
  // A missing member profile only downgrades a name to "Người kia", so a failure
  // here must not take the feed down with it.
  const members = trpc.space.members.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });

  /*
   * Where the read line stood when this visit began.
   *
   * `undefined` while unknown, so nothing is marked before the answer arrives —
   * a flash of "everything is new" would be worse than a beat with no marks.
   * `null` means the feed has never been opened, and then everything the other
   * person has added is new.
   *
   * Frozen for the visit on purpose. The feed marks itself seen the moment it
   * opens (that is what clears the badge), so reading the live watermark would
   * erase the distinction in the same breath as showing it — the reader would
   * never see which entries they had not seen.
   */
  const [seenBefore, setSeenBefore] = useState<Date | null | undefined>(undefined);

  const markSeen = trpc.activity.markSeen.useMutation({
    onSuccess: (res) => {
      setSeenBefore(res.previousSeenAt ? new Date(res.previousSeenAt) : null);
      utils.activity.unreadCount.invalidate();
    },
    onError: () => toast("Chưa đánh dấu được là đã xem, thử lại sau nhé", "error"),
  });

  // Fire exactly once per mount; the ref makes including `markSeen` in the deps
  // (its identity changes every render) harmless.
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current) return;
    marked.current = true;
    markSeen.mutate();
  }, [markSeen]);

  const memberById = useMemo(
    () => new Map((members.data ?? []).map((m) => [m.id, m])),
    [members.data],
  );

  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const days = useMemo(() => byDay(items), [items]);

  /*
   * What counts as unread.
   *
   * Only the other person's activity. Your own additions are not news to you,
   * and the badge already counts it that way — marking them would put a "new"
   * flag on something you did thirty seconds ago.
   */
  const isSelf = (actorId: string) => memberById.get(actorId)?.isSelf === true;
  const newSince = (actorId: string, at: Date) =>
    seenBefore !== undefined &&
    !isSelf(actorId) &&
    (seenBefore === null || at > seenBefore);
  const burstUnread = (burst: { actorId: string; createdAt: Date }) =>
    newSince(burst.actorId, burst.createdAt);

  /*
   * The boundary gets a label of its own, above the newest unread entry.
   *
   * Per-row marks say which entries are new; only a line says where "new" stops
   * — which is the thing a reader scans for. The feed is newest-first, so the
   * first unread in render order is the top of the new block.
   */
  const firstUnreadKey = useMemo(() => {
    for (const day of days) {
      for (const burst of day.bursts) {
        if (burstUnread(burst)) return burst.key;
      }
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, seenBefore, memberById]);

  function actorName(actorId: string): string {
    const m = memberById.get(actorId);
    if (m?.isSelf) return "Bạn";
    // Unknown actor = a partner whose profile didn't load (or who left).
    return m?.name || "Người kia";
  }

  const canLoadMore = Boolean(list.data?.nextCursor) && limit < MAX_ITEMS;

  return (
    /*
     * Full-width shell, capped feed. A chronological list of one-line events
     * is the clearest case where stretching hurts: at 1400px the actor, the
     * verb and the timestamp end up so far apart the eye has to travel to
     * connect them. The band and the page rhythm match every other route; the
     * list stays at a reading width and centres inside it.
     */
    <PageShell
      className="space-y-6"
      header={
        <PageHeader
          title="Hoạt động"
          subtitle="Những gì tụi mình đã thêm vào không gian chung."
          art="bannerWide"
          artPosition="center 45%"
        />
      }
    >
      <div className="mx-auto w-full max-w-3xl space-y-6">

      {list.isPending && <FeedSkeleton />}

      {list.isError && (
        <div
          role="alert"
          className="border-border bg-card flex flex-col items-center gap-3 rounded-xl border p-6 text-center"
        >
          <p className="font-medium">Không tải được hoạt động</p>
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
          icon="sparkles"
          art="emptyCompass"
          title="Chưa có hoạt động nào"
          subtitle="Khi một trong hai người thêm kỷ niệm, địa điểm hay kế hoạch, nó sẽ hiện ở đây."
          action={{ label: "Thêm kỷ niệm đầu tiên", href: "/timeline" }}
        />
      )}

      {list.isSuccess &&
        days.map((day) => (
          <section key={day.dayKey} className="space-y-3">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {dayLabel(day.dayKey)}
            </h2>

            <StaggerList>
              {day.bursts.map((burst) => {
                const meta = KIND_META[burst.kind];
                const KindIcon = meta.icon;
                const count = burst.items.length;
                const quantity = count > 1 ? String(count) : "một";

                const unread = burstUnread(burst);

                return (
                  <div key={burst.key} className="space-y-3">
                    {burst.key === firstUnreadKey && (
                      <div className="flex items-center gap-2" aria-hidden="true">
                        <span className="bg-accent/50 h-px flex-1" />
                        <span className="text-accent text-[11px] font-semibold tracking-wide uppercase">
                          Mới
                        </span>
                        <span className="bg-accent/50 h-px flex-1" />
                      </div>
                    )}
                  <Card
                    className={cn(
                      "flex gap-3",
                      // Three signals rather than one, because any single one is
                      // easy to miss: an edge down the side to catch the eye
                      // while scrolling, a tint so the block reads as a group,
                      // and a dot on the line that names who did it.
                      unread && "border-l-accent bg-accent-soft/40 border-l-[3px]",
                    )}
                  >
                    <ActorAvatar member={memberById.get(burst.actorId)} />

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <p className={cn("text-sm", unread ? "font-semibold" : "font-medium")}>
                          {unread && (
                            <span
                              className="bg-accent mr-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full align-middle"
                              aria-hidden="true"
                            />
                          )}
                          {actorName(burst.actorId)} {meta.verb} {quantity} {meta.noun}
                          <span className="sr-only">{unread ? " — chưa xem" : ""}</span>
                        </p>
                        <time
                          dateTime={burst.createdAt.toISOString()}
                          className="text-muted-foreground text-xs"
                        >
                          {formatDistanceToNow(burst.createdAt, {
                            addSuffix: true,
                            locale: vi,
                          })}
                        </time>
                      </div>

                      <ul className="space-y-1">
                        {burst.items.map((item) => {
                          /*
                           * Marked per entry as well as per card.
                           *
                           * A burst is a whole run of one kind by one person, so
                           * "the other person saved 3 places" can hold two that
                           * were read yesterday and one from a minute ago. The
                           * card says the group has something new; this says
                           * which line it is.
                           */
                          const itemNew = newSince(burst.actorId, item.createdAt);
                          return (
                          <li key={item.id}>
                            <Link
                              href={item.href}
                              className={cn(
                                "hover:bg-muted flex min-h-10 items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
                                "focus-visible:ring-ring/50 outline-none focus-visible:ring-2",
                              )}
                            >
                              <KindIcon
                                className="text-accent h-4 w-4 shrink-0"
                                aria-hidden="true"
                              />
                              <span
                                className={cn(
                                  "min-w-0 flex-1 truncate text-sm",
                                  itemNew && "text-foreground font-semibold",
                                )}
                              >
                                {item.title}
                              </span>
                              {/* Allowed to shrink and truncate. As shrink-0 a
                                  full date range ("06/09/2026 - 16/09/2026")
                                  could not yield, so once the title had
                                  truncated to nothing the row still pushed 14px
                                  past the screen at 320px. */}
                              {item.subtitle && (
                                <span className="text-muted-foreground min-w-0 max-w-[52%] truncate text-xs">
                                  {item.subtitle}
                                </span>
                              )}
                            </Link>
                          </li>
                          );
                        })}
                      </ul>
                    </div>
                  </Card>
                  </div>
                );
              })}
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
      </div>
    </PageShell>
  );
}
