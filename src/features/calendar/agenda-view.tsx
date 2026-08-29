"use client";

import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerList } from "@/components/ui/stagger-list";
import { todayKey } from "@/lib/date-keys";
import { colorsForTags, mergeTags } from "@/lib/plan-meta";
import { ChevronRight } from "lucide-react";

// Agenda window: today through ~3 months ahead (bounded, not unlimited).
function rangeKeys(): { fromKey: string; toKey: string } {
  const from = todayKey();
  const y = Number(from.slice(0, 4));
  const m = Number(from.slice(5, 7));
  const total = m - 1 + 3;
  const toY = y + Math.floor(total / 12);
  const toM = (total % 12) + 1;
  return { fromKey: from, toKey: `${toY}-${String(toM).padStart(2, "0")}-01` };
}

function formatDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("vi-VN", { weekday: "short", day: "numeric", month: "numeric" });
}

export function AgendaView({ onSelectDay }: { onSelectDay: (dateKey: string) => void }) {
  const { fromKey, toKey } = rangeKeys();
  const items = trpc.planItem.listByRange.useQuery({ fromKey, toKey });
  const tags = trpc.space.tags.useQuery();
  const palette = tags.data ?? mergeTags(undefined);

  if (items.isLoading) return <Skeleton className="h-60 w-full" />;

  const grouped = (items.data ?? []).reduce<Record<string, typeof items.data>>((acc, it) => {
    (acc[it.date] ??= []).push(it);
    return acc;
  }, {});
  const days = Object.keys(grouped).sort();

  if (days.length === 0) {
    return (
      <EmptyState
        icon="calendar-heart"
        art="calendarTablet"
        title="Chưa có kế hoạch sắp tới"
        subtitle="Mở một ngày trên lịch để thêm việc cùng nhau nhé."
        action={{ label: "Xem lịch tháng", onClick: () => onSelectDay(todayKey()) }}
      />
    );
  }

  return (
    <StaggerList gap="space-y-3">
      {days.map((key) => {
        const dayItems = grouped[key] ?? [];
        const colors = [...new Set(colorsForTags(dayItems.flatMap((i) => i.tags), palette))].slice(0, 4);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelectDay(key)}
            className="bg-card border-border hover:border-accent flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold capitalize">{formatDay(key)}</p>
              <p className="text-muted-foreground truncate text-xs">
                {dayItems.length} việc · {dayItems.filter((i) => i.status === "done").length} xong
              </p>
            </div>
            <div className="flex items-center gap-0.5">
              {colors.map((c, i) => (
                <span key={i} className="h-2 w-2 rounded-full" style={{ backgroundColor: c }} />
              ))}
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
          </button>
        );
      })}
    </StaggerList>
  );
}
