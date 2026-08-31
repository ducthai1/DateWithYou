"use client";

import { useEffect, useRef, useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import { PageShell, PageHeader } from "@/components/layout/page-shell";
import { CalendarGrid } from "./calendar-grid";
import { CalendarHeader } from "./calendar-header";
import { CalendarWeekView } from "./calendar-week-view";
import { AgendaView } from "./agenda-view";
import { DayDetail } from "./day-detail";
import { CountdownBanner } from "./countdown-banner";
import { SpecialDatesPanel } from "./special-dates-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal, ModalHeader } from "@/components/ui/modal";
import { Star } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useIsMobile } from "@/hooks/use-media-query";

const VIEW_TABS = [
  { key: "month", label: "Tháng" },
  { key: "agenda", label: "Nhật ký" },
] as const;

const initialYM = () => {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};

export function CalendarView() {
  /*
   * `?d=YYYY-MM-DD` opens straight onto that day.
   *
   * Everything on /home that mentions a plan used to link at "/calendar" and
   * stop there, leaving the reader to find the day they had just been reading
   * about. The date travels in the URL rather than in client state so the link
   * survives a new tab, a bookmark and the back button.
   */
  const requestedDay = useSearchParams().get("d");
  const [{ year, month }, setYM] = useState(initialYM);
  const [view, setView] = useState<(typeof VIEW_TABS)[number]["key"]>("month");
  const [selected, setSelected] = useState<string | null>(null);

  /*
   * Honour the deep link once per distinct date, not on every render: the
   * reader has to be able to close the day detail and stay on the month, and
   * re-opening it because the query string still says so would trap them.
   */
  const handledDay = useRef<string | null>(null);
  useEffect(() => {
    if (!requestedDay || handledDay.current === requestedDay) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDay)) return;
    handledDay.current = requestedDay;
    const [y, m] = requestedDay.split("-").map(Number);
    setYM({ year: y, month: m - 1 });
    setSelected(requestedDay);
  }, [requestedDay]);
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
    <PageShell
      className="space-y-4"
      header={
        <PageHeader
          title="Lịch"
          subtitle="Lịch tháng, nhật ký việc và ngày đặc biệt của tụi mình."
          art="calendarTablet"
          banner={<CountdownBanner />}
        />
      }
    >

      <div className="flex items-center gap-2">
        <Tabs tabs={VIEW_TABS} value={view} onChange={setView} className="w-max max-w-full" />
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
    </PageShell>
  );
}
