"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { todayKey } from "@/lib/date-keys";
import { useIsMobile } from "@/hooks/use-media-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { Modal, ModalHeader } from "@/components/ui/modal";
import { Star } from "lucide-react";
import { CalendarHeader } from "./calendar-header";
import { CalendarGrid } from "./calendar-grid";
import { CalendarWeekView } from "./calendar-week-view";
import { CountdownBanner } from "./countdown-banner";
import { AgendaView } from "./agenda-view";
import { SpecialDatesPanel } from "./special-dates-panel";
import { DayDetail } from "./day-detail";

const VIEW_TABS = [
  { key: "month", label: "Tháng" },
  { key: "agenda", label: "Sắp tới" },
] as const;

function initialYM(): { year: number; month: number } {
  const k = todayKey();
  return { year: Number(k.slice(0, 4)), month: Number(k.slice(5, 7)) };
}

export function CalendarView() {
  const [{ year, month }, setYM] = useState(initialYM);
  const [view, setView] = useState<(typeof VIEW_TABS)[number]["key"]>("month");
  const [selected, setSelected] = useState<string | null>(null);
  const [specialsOpen, setSpecialsOpen] = useState(false);

  const summary = trpc.calendar.monthSummary.useQuery({ year, month });

  // Mobile gets the week view, desktop the month grid. We resolve the viewport
  // only after mount so the first client render matches the server (no hydration
  // mismatch) — until then a neutral skeleton stands in.
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const prev = () => setYM((s) => (s.month === 1 ? { year: s.year - 1, month: 12 } : { ...s, month: s.month - 1 }));
  const next = () => setYM((s) => (s.month === 12 ? { year: s.year + 1, month: 1 } : { ...s, month: s.month + 1 }));
  const goToday = () => setYM(initialYM());

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 px-4 pt-5 pb-5 md:px-[30px]">
      <CountdownBanner />

      <div className="flex items-center gap-2">
        <Tabs tabs={VIEW_TABS} value={view} onChange={setView} className="flex-1" />
        <button
          type="button"
          onClick={() => setSpecialsOpen(true)}
          aria-label="Ngày đặc biệt"
          title="Ngày đặc biệt"
          className="text-muted-foreground hover:bg-muted bg-card border-border flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
        >
          <Star className="h-5 w-5" />
        </button>
      </div>

      {view === "month" ? (
        // Before mount we can't know the viewport without risking a hydration
        // mismatch, so render a neutral skeleton, then swap to the mobile
        // week view or the desktop grid once the media query is known.
        !mounted ? (
          <Skeleton className="h-80 w-full" />
        ) : isMobile ? (
          <CalendarWeekView />
        ) : (
          <>
            <CalendarHeader year={year} month={month} onPrev={prev} onNext={next} onToday={goToday} />
            {summary.isLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <CalendarGrid year={year} month={month} summary={summary.data ?? {}} onSelectDay={setSelected} />
            )}
          </>
        )
      ) : (
        <AgendaView onSelectDay={setSelected} />
      )}

      {selected && <DayDetail date={selected} onClose={() => setSelected(null)} />}

      {specialsOpen && (
        <Modal open onClose={() => setSpecialsOpen(false)} className="max-w-lg">
          <ModalHeader title="Ngày đặc biệt 💞" onClose={() => setSpecialsOpen(false)} />
          <SpecialDatesPanel />
        </Modal>
      )}
    </div>
  );
}
