"use client";

// Two small countdown cards: the round day-count milestone derived from the
// anniversary, and the nearest upcoming event — which may be a special date OR
// a trip that has not left yet.

import { useEffect, useRef } from "react";
import { Sparkles, CalendarHeart } from "lucide-react";
import { resolveIcon } from "@/lib/icon-registry";
import { useCelebrate } from "@/components/ui/celebrate";
import { HomeSection } from "./home-section";
import { daysAwayLabel, milestoneLabel, shortDate, viNumber } from "./home-format";

export type MilestoneData = { target: number; daysAway: number; years: number | null };

export function MilestoneCard({
  milestone,
  daysTogether,
}: {
  milestone: MilestoneData;
  daysTogether: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const celebrate = useCelebrate();
  const landsToday = milestone.daysAway === 0;

  // One heart-burst on the day itself. useCelebrate is already a no-op under
  // prefers-reduced-motion, so there is nothing extra to guard here.
  useEffect(() => {
    if (!landsToday) return;
    const t = setTimeout(() => celebrate(cardRef.current), 350);
    return () => clearTimeout(t);
  }, [landsToday, celebrate]);

  const label = milestoneLabel(milestone.target, milestone.years);
  const headline = landsToday
    ? `Hôm nay tròn ${label} cùng nhau 🎉`
    : milestone.daysAway === 1
      ? `Ngày mai là tròn ${label} cùng nhau`
      : `Còn ${milestone.daysAway} ngày nữa là tròn ${label} cùng nhau`;

  return (
    <div ref={cardRef} className="relative">
      <HomeSection Icon={Sparkles} title="Cột mốc" highlight={landsToday}>
        <p className="text-foreground text-base font-medium leading-snug">{headline}</p>
        <p className="text-muted-foreground text-sm">
          Đang là ngày thứ {viNumber(daysTogether)} của tụi mình.
        </p>
      </HomeSection>
    </div>
  );
}

/**
 * Whatever is soonest, from `lib/next-up.ts`.
 *
 * Was special-dates-only, which meant a trip leaving in five days never
 * reached this screen at all: the only trip query on /home matches one already
 * under way. Both kinds arrive here now, so the card has to say the right
 * thing for each — "sắp tới" reads oddly over a departure, and a trip has
 * somewhere to tap through to while a birthday does not.
 */
export type NextUpEvent = {
  kind: "special" | "trip";
  title: string;
  icon: string | null;
  occursOn: string;
  daysUntil: number;
  href: string | null;
};

export function SpecialDateCountdownCard({ event }: { event: NextUpEvent }) {
  const Icon = resolveIcon(event.icon ?? undefined);
  const isToday = event.daysUntil === 0;
  const isTrip = event.kind === "trip";

  const title = isToday
    ? isTrip
      ? "Hôm nay khởi hành"
      : "Hôm nay là ngày đặc biệt"
    : isTrip
      ? "Chuyến đi sắp tới"
      : "Sắp tới";

  const headline = isToday
    ? isTrip
      ? `${event.title} — đi thôi 🧳`
      : `${event.title} — chúc tụi mình một ngày thật đẹp 🎉`
    : event.title;

  return (
    <HomeSection
      Icon={isToday || isTrip ? Icon : CalendarHeart}
      title={title}
      // A trip has a page of its own worth opening; a date belongs to the calendar.
      link={isTrip && event.href ? { href: event.href, label: "Chuyến đi" } : { href: "/calendar", label: "Lịch" }}
      highlight={isToday}
    >
      <p className="text-foreground text-base font-medium leading-snug">{headline}</p>
      <p className="text-muted-foreground text-sm">
        {isToday
          ? `Ngày ${shortDate(event.occursOn)}`
          : `${daysAwayLabel(event.daysUntil)} · ${shortDate(event.occursOn)}`}
      </p>
    </HomeSection>
  );
}
