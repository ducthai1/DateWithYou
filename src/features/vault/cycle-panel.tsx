"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { shortDateLabel } from "@/lib/cycle-copy";
import { daysBetweenKeys, todayKey } from "@/lib/date-keys";
import { Trash2, Plus, Info } from "lucide-react";

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
  const [draft, setDraft] = useState("");

  const invalidate = () => {
    void utils.cycle.get.invalidate();
    // The calendar paints the predicted day from the same source.
    void utils.calendar.monthSummary.invalidate();
    void utils.calendar.dayDetail.invalidate();
  };
  const add = trpc.cycle.addStart.useMutation({
    onSuccess: (r) => {
      if (!r.ok) return toast("Ngày đó không hợp lệ (không thể ở tương lai)", "error");
      setDraft("");
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
  // Newest first: the recent months are the ones being checked and corrected.
  const recent = [...starts].sort().reverse();

  return (
    <div className="space-y-4">
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
              {prediction.spreadDays > 0 && (
                <span className="text-muted-foreground ml-1.5 text-base font-medium">
                  ± {prediction.spreadDays} ngày
                </span>
              )}
            </p>
            {/* The count is the entries the reader actually typed, not
                `samples + 1`: a dropped implausible gap makes those two differ,
                and showing a smaller number than they entered is exactly what
                makes a figure look untrustworthy. */}
            <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
              Tính từ <strong>{starts.length} mốc</strong> bạn đã nhập — nhịp khoảng{" "}
              <strong>{prediction.cycleDays} ngày</strong>. Thêm mốc thì càng sát.
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              {(() => {
                const away = daysBetweenKeys(todayKey(), prediction.nextStart);
                if (away === 0) return "Là hôm nay.";
                if (away === 1) return "Còn 1 ngày nữa.";
                return `Còn khoảng ${away} ngày nữa.`;
              })()}
            </p>
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
      <div className="border-border bg-card space-y-2 rounded-2xl border p-4">
        <label htmlFor="cycle-date" className="text-foreground block text-sm font-medium">
          Thêm một mốc
        </label>
        <div className="flex gap-2">
          <input
            id="cycle-date"
            type="date"
            aria-label="Ngày bắt đầu của một mốc"
            value={draft}
            max={todayKey()}
            onChange={(e) => setDraft(e.target.value)}
            className="border-border focus:border-accent bg-card min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
          />
          <Button
            className="shrink-0 gap-1.5"
            disabled={!draft || add.isPending}
            onClick={() => add.mutate({ date: draft })}
          >
            <Plus className="h-4 w-4" /> Thêm
          </Button>
        </div>
        <p className="text-muted-foreground flex items-start gap-1.5 text-xs leading-relaxed">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Chỉ cần <strong>ngày đầu tiên</strong> của mỗi lần, không cần ngày kết thúc. Nhập
          được cả các tháng đã qua.
        </p>
      </div>

      {/* ── What has been entered ── */}
      {recent.length === 0 ? (
        <EmptyState
          icon="sparkles"
          art="skyWordmark"
          title="Chưa có mốc nào"
          subtitle="Thêm vài mốc gần đây để app tính giúp bạn."
        />
      ) : (
        <ul className="border-border divide-border divide-y rounded-2xl border">
          {recent.map((date, i) => {
            // The gap to the previous entry, which is what the rhythm is made
            // of — showing it makes a mistyped year obvious at a glance.
            const older = recent[i + 1];
            const gap = older ? daysBetweenKeys(older, date) : null;
            return (
              <li key={date} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-foreground text-sm font-medium">{shortDateLabel(date)}</p>
                  <p className="text-muted-foreground text-xs">
                    {date}
                    {gap != null && <span> · cách lần trước {gap} ngày</span>}
                  </p>
                </div>
                <ConfirmButton
                  idle=""
                  icon={<Trash2 className="h-4 w-4" />}
                  aria-label={`Xoá mốc ${date}`}
                  title="Xoá mốc này?"
                  description={`Mốc ${date} sẽ bị xoá và nhịp sẽ được tính lại.`}
                  disabled={remove.isPending}
                  className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  onConfirm={() => remove.mutate({ date })}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
