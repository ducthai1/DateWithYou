"use client";

// What the couple already put on the calendar for today. Read-only on purpose:
// this screen hands things over, it doesn't ask for input — editing lives in
// /calendar, one tap away.

import { CalendarCheck, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { HomeSection, SectionPrompt } from "./home-section";
import { bucketLabel } from "./home-format";

export type HomePlanItem = {
  id: string;
  title: string;
  date: string;
  bucket: string;
  time: string | null;
  status: string;
  tags: string[];
  assigneeId: string | null;
};

export function PlanRow({ item }: { item: HomePlanItem }) {
  const done = item.status === "done";
  const skipped = item.status === "skipped";
  return (
    <li className="flex min-h-10 items-center gap-2.5 py-1">
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          done ? "bg-accent text-accent-foreground" : "bg-muted",
        )}
        aria-hidden="true"
      >
        {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          done && "text-muted-foreground line-through",
          skipped && "text-muted-foreground",
        )}
      >
        {item.title}
      </span>
      {item.time && (
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{item.time}</span>
      )}
      <Badge tone={done ? "accent" : "neutral"} className="shrink-0">
        {bucketLabel(item.bucket)}
      </Badge>
    </li>
  );
}

export function TodayPlansCard({
  items,
  hasAnyPlan,
}: {
  items: HomePlanItem[];
  hasAnyPlan: boolean;
}) {
  const doneCount = items.filter((i) => i.status === "done").length;

  return (
    <HomeSection
      Icon={CalendarCheck}
      title="Hôm nay của tụi mình"
      link={{ href: "/calendar", label: "Lịch" }}
    >
      {items.length === 0 ? (
        <SectionPrompt
          text={
            hasAnyPlan
              ? "Hôm nay lịch đang trống. Thảnh thơi cũng là một kiểu hẹn hò mà."
              : "Chưa có kế hoạch nào cả. Một ly cà phê chiều nay cũng đáng để ghi vào đó."
          }
          action={{ href: "/calendar", label: "Thêm vào hôm nay" }}
        />
      ) : (
        <>
          <ul className="divide-border/60 divide-y">
            {items.map((item) => (
              <PlanRow key={item.id} item={item} />
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">
            {doneCount > 0
              ? `Đã xong ${doneCount}/${items.length} việc hôm nay.`
              : `${items.length} việc đang chờ tụi mình.`}
          </p>
        </>
      )}
    </HomeSection>
  );
}
