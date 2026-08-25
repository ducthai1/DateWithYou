"use client";

// The next few days, grouped by day. Short by design — anything longer belongs
// in /calendar, which the header links to.

import { CalendarDays } from "lucide-react";
import { HomeSection, SectionPrompt } from "./home-section";
import { PlanRow, type HomePlanItem } from "./today-plans-card";
import { dayLabel } from "./home-format";

export function UpcomingCard({
  items,
  today,
  hasAnyPlan,
}: {
  items: HomePlanItem[];
  today: string;
  hasAnyPlan: boolean;
}) {
  // Preserve server order (date asc, then order) while grouping.
  const groups: { key: string; items: HomePlanItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.key === item.date) last.items.push(item);
    else groups.push({ key: item.date, items: [item] });
  }

  return (
    <HomeSection
      Icon={CalendarDays}
      title="Vài ngày tới"
      link={{ href: "/calendar", label: "Xem lịch" }}
    >
      {groups.length === 0 ? (
        <SectionPrompt
          text={
            hasAnyPlan
              ? "Tuần này chưa có gì trong lịch. Rủ người ấy đi đâu đó chăng?"
              : "Chưa có kế hoạch nào sắp tới. Ghi một buổi hẹn vào lịch xem sao."
          }
          action={{ href: "/calendar", label: "Lên kế hoạch" }}
        />
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <section key={g.key} className="space-y-1">
              <h3 className="text-muted-foreground text-xs font-medium">
                {dayLabel(g.key, today)}
              </h3>
              <ul className="divide-border/60 divide-y">
                {g.items.map((item) => (
                  <PlanRow key={item.id} item={item} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </HomeSection>
  );
}
