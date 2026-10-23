"use client";

import { useEffect, useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import { PageShell, PageHeader } from "@/components/layout/page-shell";
import { CalendarGrid } from "./calendar-grid";
import { CalendarHeader } from "./calendar-header";
import { CalendarWeekView } from "./calendar-week-view";
import { AgendaView } from "./agenda-view";
import { DayDetail } from "./day-detail";
import { CountdownBanner } from "./countdown-banner";
import { SpecialDatesPanel } from "./special-dates-panel";
import { LoadFailed } from "@/components/ui/load-failed";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal, ModalHeader } from "@/components/ui/modal";
import { Star } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { replaceQuery, useQueryEnum, useQueryParam } from "@/hooks/use-query-state";
import { dayParam, formatMonthParam, parseMonthParam, type QueryPatch } from "@/lib/url-query";
import { todayKey } from "@/lib/date-keys";
import { useIsMobile } from "@/hooks/use-media-query";
import { useAppReady } from "@/components/layout/boot-veil-dismiss";

const VIEW_TABS = [
  { key: "month", label: "Tháng" },
  { key: "agenda", label: "Nhật ký" },
] as const;

const VIEWS = VIEW_TABS.map((t) => t.key);

const initialYM = () => {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};

const isThisMonth = (ym: { year: number; month: number }) => {
  const now = initialYM();
  return ym.year === now.year && ym.month === now.month;
};

// `m` is already 1-based — it comes out of a YYYY-MM-DD key, and every month in
// this screen is 1-based too (initialYM adds 1 to getMonth(), the grid documents
// "1-12", the server validates min(1).max(12)). Subtracting one treated it as a
// Date month once, so a link to 31/08 opened the right day and then left July
// behind it, and a link to any January produced month 0, which the summary
// query rejects outright.
const monthOfDay = (day: string) => ({ year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) });

export function CalendarView() {
  /*
   * View, month and open day all live in the query string:
   * `?view=agenda`, `?month=2026-08`, `?d=2026-08-31`.
   *
   * `?d=` came first. Everything on /home that mentions a plan used to link at
   * "/calendar" and stop there, leaving the reader to find the day they had
   * just been reading about. The month and the view followed it so that a
   * reload stays where the reader was instead of snapping back to this month.
   *
   * Closing the day removes `d`, so a deep link cannot trap the reader in the
   * dialog — the job the old "honour it once" ref used to do.
   */
  const [view, setView] = useQueryEnum("view", VIEWS, "month");
  const selected = dayParam(useQueryParam("d"));
  const monthParam = parseMonthParam(useQueryParam("month"));
  const weekStripDay = dayParam(useQueryParam("day"));
  // A deep link names only the day; the month to show is that day's.
  const { year, month } = monthParam ?? (selected ? monthOfDay(selected) : initialYM());
  const [specialsOpen, setSpecialsOpen] = useState(false);

  const setYM = (ym: { year: number; month: number }) =>
    replaceQuery({ month: isThisMonth(ym) ? null : formatMonthParam(ym) });
  const openDay = (day: string) => replaceQuery({ d: day });
  const closeDay = () => {
    const patch: QueryPatch = { d: null };
    if (selected) {
      // The month on screen came from the day; pin it, or closing the dialog
      // would drop the reader back on this month.
      if (!monthParam && !isThisMonth(monthOfDay(selected))) patch.month = formatMonthParam(monthOfDay(selected));
      // The phone's week strip stays on the day that was open.
      if (!weekStripDay && selected !== todayKey()) patch.day = selected;
    }
    replaceQuery(patch);
  };

  const summary = trpc.calendar.monthSummary.useQuery({ year, month });
  // Tấm khởi động đợi màn này: mở app đúng ở đây thì không được gỡ tấm che
  // trong lúc còn khung xương. Báo cả khi lỗi — thẻ "thử lại" hơn là màn navy.
  useAppReady(!summary.isPending);

  // Mobile gets the week view, desktop the month grid. We resolve the viewport
  // only after mount so the first client render matches the server (no hydration
  // mismatch) — until then a neutral skeleton stands in.
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const prev = () => setYM(month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 });
  const next = () => setYM(month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 });
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
            ) : summary.isError ? (
              /* Bản trước vẽ lưới với `summary.data ?? {}` khi hỏng, tức một
                 tháng TRỐNG TRƠN không nói gì — người xem đọc ra là tháng đó
                 chẳng có gì, chứ không phải là chưa tải được. */
              <LoadFailed
                what="lịch tháng này"
                onRetry={() => void summary.refetch()}
                retrying={summary.isFetching}
              />
            ) : (
              <CalendarGrid year={year} month={month} summary={summary.data ?? {}} onSelectDay={openDay} />
            )}
          </>
        )
      ) : (
        <AgendaView onSelectDay={openDay} />
      )}

      {selected && <DayDetail date={selected} onClose={closeDay} />}

      {specialsOpen && (
        <Modal open onClose={() => setSpecialsOpen(false)} className="max-w-lg">
          <ModalHeader title="Ngày đặc biệt" onClose={() => setSpecialsOpen(false)} />
          <SpecialDatesPanel />
        </Modal>
      )}
    </PageShell>
  );
}
