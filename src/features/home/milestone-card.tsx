"use client";

// Two small countdown cards: the round day-count milestone derived from the
// anniversary, and the nearest upcoming special date.

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
    ? `Hôm nay tròn ${label} bên nhau 🎉`
    : milestone.daysAway === 1
      ? `Ngày mai là tròn ${label} bên nhau`
      : `Còn ${milestone.daysAway} ngày nữa là tròn ${label} bên nhau`;

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

export type NextSpecialDate = {
  id: string;
  title: string;
  icon: string | null;
  date: string;
  occursOn: string;
  daysUntil: number;
};

export function SpecialDateCountdownCard({ event }: { event: NextSpecialDate }) {
  const Icon = resolveIcon(event.icon ?? undefined);
  const isToday = event.daysUntil === 0;

  return (
    <HomeSection
      Icon={isToday ? Icon : CalendarHeart}
      title={isToday ? "Hôm nay là ngày đặc biệt" : "Sắp tới"}
      link={{ href: "/calendar", label: "Lịch" }}
      highlight={isToday}
    >
      <p className="text-foreground text-base font-medium leading-snug">
        {isToday ? `${event.title} — chúc tụi mình một ngày thật đẹp 🎉` : event.title}
      </p>
      <p className="text-muted-foreground text-sm">
        {isToday
          ? `Ngày ${shortDate(event.occursOn)}`
          : `${daysAwayLabel(event.daysUntil)} · ${shortDate(event.occursOn)}`}
      </p>
    </HomeSection>
  );
}
