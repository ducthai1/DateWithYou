"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { shortDateLabel } from "@/lib/cycle-copy";
import { CYCLE_PEAK_DISC, CYCLE_WINDOW_TEXT } from "@/lib/cycle-day-style";
import { cn } from "@/lib/utils";
import { addDaysKey, daysBetweenKeys, todayKey } from "@/lib/date-keys";
import { Plus, Info } from "lucide-react";
import { CycleLogList } from "./cycle-log-list";

/** The day-of-month as it appears in a calendar cell, e.g. "2026-09-10" → 10. */
const dayNum = (key: string) => Number(key.slice(8, 10));


/**
 * The quiet page behind the vault door.
 *
 * Two deliberate choices about tone. The dates go in here — inside the section
 * the app already treats as private — rather than on the calendar, which is
 * glanced at all day. And what it says back is chosen for whoever is reading:
 * the same panel addresses him about her, and her about herself.
 *
 * It shows the ± on the prediction instead of a single confident date. A body
 * that varies by four days does not owe anyone a precise answer, and hiding
 * that variance is how a reminder ends up feeling wrong.
 */
export function CyclePanel() {
  const toast = useToast();
  const utils = trpc.useUtils();
  const q = trpc.cycle.get.useQuery();
  /*
   * The field starts on today rather than empty.
   *
   * An empty native date input shows the browser's placeholder — "mm/dd/yyyy"
   * on an English-locale machine, which is both blank and in the wrong order
   * for the person reading it. Today is also very nearly always the answer, so
   * the panel opens one tap from saving instead of three.
   */
  const [today] = useState(todayKey);
  const [draft, setDraft] = useState(today);

  const invalidate = () => {
    void utils.cycle.get.invalidate();
    // The calendar paints the predicted day from the same source.
    void utils.calendar.monthSummary.invalidate();
    void utils.calendar.dayDetail.invalidate();
  };
  const add = trpc.cycle.addStart.useMutation({
    onSuccess: (r) => {
      if (!r.ok) return toast("Ngày đó không hợp lệ (không thể ở tương lai)", "error");
      setDraft(today);
      invalidate();
      toast("Đã lưu", "success");
    },
    onError: () => toast("Chưa lưu được, thử lại nhé", "error"),
  });
  const remove = trpc.cycle.removeStart.useMutation({
    onSuccess: () => {
      invalidate();
      toast("Đã xoá mốc này", "success");
    },
    onError: () => toast("Chưa xoá được", "error"),
  });

  if (q.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  const starts = q.data?.starts ?? [];
  const prediction = q.data?.prediction ?? null;
  /*
   * Saving is $addToSet, so adding a date already logged silently does nothing
   * and the toast still says "Đã lưu". Better to say so before the tap — and
   * it matters more now that the field defaults to today, which is exactly the
   * date most likely to be in there already.
   */
  const duplicate = starts.includes(draft);

  return (
    // Capped: on a wide screen the uncapped version stretched a date field to
    // ~1300px and parked its button a screen away from it, and every row's
    // delete button sat far from the row it deletes.
    <div className="max-w-3xl space-y-4">
      {/* ── Next period ──
          Stated as a figure that was worked out, not as a hunch: "dự kiến" is
          the word Vietnamese already uses for a computed date (ngày dự kiến
          sinh), and the rhythm it came from is shown right under it so the
          number is checkable rather than magic. */}
      <div className="border-border bg-card rounded-2xl border p-5 shadow-sm">
        <p className="text-accent text-sm font-semibold">Kỳ tiếp theo</p>
        {prediction ? (
          <>
            <p className="text-foreground mt-2 text-2xl font-bold tracking-tight">
              Dự kiến {shortDateLabel(prediction.nextStart)}
            </p>
            {/* Only when the body actually varies. A window on a perfectly
                regular rhythm would invent doubt that the data does not show. */}
            {prediction.windowStart !== prediction.windowEnd && (
              <p className="text-muted-foreground mt-0.5 text-sm font-medium">
                Có thể trong khoảng {shortDateLabel(prediction.windowStart)}–
                {shortDateLabel(prediction.windowEnd)}
              </p>
            )}
            {/* Numbers as chips, not as a sentence.
                The prose version — "Tính từ 5 mốc bạn đã nhập · nhịp 28–30
                ngày (trung bình 29, tháng gần đây tính nặng hơn)." — took
                three ragged lines on a 320px phone, which is the width this
                panel is actually read at. Chips wrap as whole facts instead of
                breaking a parenthesis across lines. */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Stat label="mốc đã nhập" value={`${starts.length}`} />
              {prediction.shortestCycle === prediction.longestCycle ? (
                <Stat label="nhịp đều" value={`${prediction.cycleDays} ngày`} />
              ) : (
                <>
                  <Stat
                    label="nhịp"
                    value={`${prediction.shortestCycle}–${prediction.longestCycle} ngày`}
                  />
                  <Stat label="trung bình" value={`${prediction.cycleDays} ngày`} />
                </>
              )}
              <Stat
                label="còn"
                value={(() => {
                  const away = daysBetweenKeys(todayKey(), prediction.nextStart);
                  if (away === 0) return "hôm nay";
                  return `${away} ngày`;
                })()}
              />
            </div>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              Các tháng gần đây được tính nặng hơn, nên nhịp thay đổi thì con số cũng đi
              theo.
            </p>
            {/* The two marks exactly as the calendar draws them.
                On a phone the calendar has room for a colour and nothing else,
                so the colour has to be learnable somewhere — and here, where
                the dates are entered, is the one place that is already about
                this. Same constants as the grid, so a change to one changes
                the legend with it. */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                    CYCLE_PEAK_DISC,
                  )}
                  aria-hidden="true"
                >
                  {dayNum(prediction.nextStart)}
                </span>
                <span className="text-muted-foreground">ngày dự kiến trên lịch</span>
              </span>
              {prediction.windowStart !== prediction.windowEnd && (
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn("text-[15px] font-bold", CYCLE_WINDOW_TEXT)}
                    aria-hidden="true"
                  >
                    {dayNum(prediction.windowStart)}
                  </span>
                  <span className="text-muted-foreground">các ngày trong khoảng</span>
                </span>
              )}
            </div>
            <p className="text-muted-foreground border-border mt-3 border-t pt-3 text-xs leading-relaxed">
              Trước 2 ngày và đúng ngày này, app sẽ nhắc nhẹ cả hai người.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Cần ít nhất <strong>2 mốc</strong> để tính được nhịp. Nhập vài mốc gần đây bên
            dưới, app tự tính — không cần làm gì thêm.
          </p>
        )}
      </div>

      {/* ── Add a date ── */}
      <div className="border-border bg-card space-y-3 rounded-2xl border p-4 shadow-sm">
        {/* Not a <label htmlFor>: the control below is a button, and a label
            cannot point at one — it carries its own aria-label instead. */}
        <p className="text-foreground text-sm font-medium">Thêm một mốc</p>
        {/* Two taps for the common case. Almost every entry is today or
            yesterday — you notice, and you log it then or the next morning —
            and reaching that through a date picker is three taps and a lot of
            precision for something the app already knows. */}
        <div className="flex flex-wrap gap-1.5">
          <QuickDate label="Hôm nay" date={today} draft={draft} onPick={setDraft} />
          <QuickDate label="Hôm qua" date={addDaysKey(today, -1)} draft={draft} onPick={setDraft} />
        </div>
        {/* The shared DatePicker, not <input type="date">.
            Two things the native field got wrong here, both measured: it
            printed the date in the BROWSER's locale, so an English machine
            showed "09/07/2026" — 7 September here, 9 July to anyone reading it
            as American; and its calendar icon is laid out hard against the
            right edge of the field, so at the width this row gives it there
            was a 90px void between the value and the icon and the icon read as
            glued to the border. This component leads with the icon and states
            the date day-first, so neither can happen at any width. */}
        <div className="flex gap-2">
          <div className="min-w-0 flex-1 sm:max-w-[220px]">
            <DatePicker
              value={draft}
              onChange={setDraft}
              max={today}
              ariaLabel="Ngày bắt đầu của một mốc"
            />
          </div>
          <Button
            className="shrink-0 gap-1.5"
            disabled={!draft || duplicate || add.isPending}
            onClick={() => add.mutate({ date: draft })}
          >
            <Plus className="h-4 w-4" /> Thêm
          </Button>
        </div>
        {/* The icon and the words are siblings in a flex row, so the sentence
            lives inside its own element. Without that wrapper each <strong>
            became a flex item of its own and the words were dealt out in
            columns — on a narrow phone the hint read "Chỉ ngày của mỗi lần,
            không cần đầu cần ngày kết thúc. tiên Nhập được…". */}
        <p className="text-muted-foreground flex items-start gap-1.5 text-xs leading-relaxed">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {duplicate ? (
              <>Mốc này đã có trong danh sách rồi — chọn một ngày khác nhé.</>
            ) : (
              <>
                Chỉ cần <strong>ngày đầu tiên</strong> của mỗi lần. Nhập được cả các
                tháng đã qua.
              </>
            )}
          </span>
        </p>
      </div>

      {/* ── What has been entered ── */}
      {starts.length === 0 ? (
        <EmptyState
          icon="sparkles"
          art="skyWordmark"
          title="Chưa có mốc nào"
          subtitle="Thêm vài mốc gần đây để app tính giúp bạn."
        />
      ) : (
        <CycleLogList
          starts={starts}
          removing={remove.isPending}
          onRemove={(date) => remove.mutate({ date })}
        />
      )}
    </div>
  );
}

/** One number with its name under it, so a row of facts wraps as whole facts. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="bg-muted/70 rounded-xl px-2.5 py-1.5 leading-tight">
      <span className="text-foreground block text-sm font-bold tabular-nums">{value}</span>
      <span className="text-muted-foreground block text-[10px] font-medium">{label}</span>
    </span>
  );
}

/** "Hôm nay" / "Hôm qua" — highlighted when the field already holds that day. */
function QuickDate({
  label,
  date,
  draft,
  onPick,
}: {
  label: string;
  date: string;
  draft: string;
  onPick: (date: string) => void;
}) {
  const active = draft === date;
  return (
    <button
      type="button"
      onClick={() => onPick(date)}
      aria-pressed={active}
      className={cn(
        "touch-manipulation rounded-full px-3 py-1.5 text-xs font-semibold transition-colors active:scale-95",
        active
          ? "bg-accent text-accent-foreground shadow-sm"
          : "bg-muted text-muted-foreground hover:bg-accent-soft hover:text-accent",
      )}
    >
      {label}
    </button>
  );
}
