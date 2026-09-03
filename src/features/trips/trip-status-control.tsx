"use client";

import { CalendarClock, Check, Plane, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/components/ui/toast";
import { readableFormError } from "@/lib/form-error";
import { cn } from "@/lib/utils";
import {
  TRIP_STATUSES,
  TRIP_STATUS_META,
  tripNudge,
  type TripStatus,
} from "@/lib/trip-status";

const ICON: Record<TripStatus, typeof Plane> = {
  planning: CalendarClock,
  active: Plane,
  completed: Check,
};

/**
 * Changing a trip's status without opening anything.
 *
 * It used to live behind the trip's settings modal — three taps and a save to
 * say a word the couple had already said out loud. Status is the one field a
 * trip changes several times over its life, so it belongs on the surface where
 * the trip is, next to it, always visible.
 *
 * The write is optimistic because the answer is never in doubt: the row is the
 * couple's own, and the only realistic failure is the network. Home and the
 * calendar both read trip status, so both are refreshed once the write lands.
 */
function useSetTripStatus() {
  const utils = trpc.useUtils();
  const toast = useToast();
  return trpc.trip.setStatus.useMutation({
    onMutate: async ({ id, status }) => {
      await utils.trip.list.cancel();
      const prevList = utils.trip.list.getData();
      utils.trip.list.setData(undefined, (old) =>
        old?.map((t) => (t.id === id ? { ...t, status } : t)),
      );
      const prevOne = utils.trip.get.getData({ id });
      if (prevOne) utils.trip.get.setData({ id }, { ...prevOne, status });
      return { prevList, prevOne, id };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prevList) utils.trip.list.setData(undefined, ctx.prevList);
      if (ctx?.prevOne) utils.trip.get.setData({ id: ctx.id }, ctx.prevOne);
      toast(readableFormError(err.message, "Chưa đổi được trạng thái"), "error");
    },
    // A trip that starts or ends changes what /home leads with and how the
    // month grid is banded, so neither can be left showing yesterday's answer.
    onSettled: () => {
      void utils.dashboard.today.invalidate();
      void utils.calendar.monthSummary.invalidate();
    },
  });
}

/** The three states, side by side. Current one filled, the others one tap away. */
export function TripStatusChips({
  tripId,
  status,
  className,
  size = "md",
}: {
  tripId: string;
  status: TripStatus;
  className?: string;
  size?: "sm" | "md";
}) {
  const setStatus = useSetTripStatus();
  return (
    <div
      role="group"
      aria-label="Trạng thái chuyến đi"
      className={cn(
        "bg-muted/70 inline-flex items-center gap-0.5 rounded-full p-0.5",
        className,
      )}
    >
      {TRIP_STATUSES.map((s) => {
        const Icon = ICON[s];
        const on = s === status;
        return (
          <button
            key={s}
            type="button"
            aria-pressed={on}
            title={TRIP_STATUS_META[s].hint}
            disabled={setStatus.isPending}
            onClick={(e) => {
              // Cards wrap this control in a link to the trip; without this a
              // tap would change the status and navigate away from the result.
              e.preventDefault();
              e.stopPropagation();
              if (!on) setStatus.mutate({ id: tripId, status: s });
            }}
            className={cn(
              "inline-flex items-center gap-1 rounded-full font-semibold transition-colors",
              size === "sm" ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]",
              on
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/70",
            )}
          >
            <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />
            <span>{size === "sm" ? TRIP_STATUS_META[s].short : TRIP_STATUS_META[s].full}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * What the dates noticed.
 *
 * Only rendered when the calendar and the stored status disagree, and it makes
 * an offer rather than a correction — a trip pushed back a week is a normal
 * thing that the app has no business overruling.
 */
export function TripNudgeBar({
  trip,
  className,
}: {
  trip: { id: string; status: TripStatus; startDate: string; endDate: string };
  className?: string;
}) {
  const setStatus = useSetTripStatus();
  const nudge = tripNudge(trip.status, trip.startDate, trip.endDate);
  if (!nudge) return null;
  return (
    <div
      className={cn(
        "bg-accent-soft/70 border-accent/25 flex items-center gap-2 rounded-xl border px-3 py-2",
        className,
      )}
    >
      <Sparkles className="text-accent h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="text-foreground/80 min-w-0 flex-1 text-xs">{nudge.label}</p>
      <button
        type="button"
        disabled={setStatus.isPending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setStatus.mutate({ id: trip.id, status: nudge.to });
        }}
        className="bg-accent text-accent-foreground hover:bg-accent-hover shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-60"
      >
        {nudge.cta}
      </button>
    </div>
  );
}
