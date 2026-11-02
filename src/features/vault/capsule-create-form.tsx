"use client";

import { useState } from "react";
import { Loader2, Lock, PenLine } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { readableFormError } from "@/lib/form-error";
import { addDaysKey, dayKeyLabel, todayKey } from "@/lib/date-keys";
import {
  LETTER_STARTERS,
  UNLOCK_SPANS,
  addMonthsKey,
  addStarter,
  capsuleTitle,
} from "@/lib/capsule-presets";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { useToast } from "@/components/ui/toast";

/** How far ahead an upcoming special day still makes sense as an unlock date. */
const OCCASION_HORIZON_DAYS = 3 * 365;
const OCCASIONS_SHOWN = 3;

/**
 * A new time capsule: when it opens is a tap, its title follows from that,
 * and the letter can start from a line instead of an empty box.
 */
export function CapsuleCreateForm({ partnerName, onDone }: { partnerName: string; onDone: () => void }) {
  const today = todayKey();
  const [message, setMessage] = useState("");
  /*
   * A capsule is "open this in a year" far more often than anything else, so
   * that is where the field starts — a date and a time, each in the shared
   * picker, instead of a native datetime-local that starts blank and draws its
   * own icon against the right edge.
   */
  const [unlockDay, setUnlockDay] = useState(() => addMonthsKey(today, 12));
  const [unlockClock, setUnlockClock] = useState("09:00");
  const [choice, setChoice] = useState<{ key: string; span?: string; occasion?: string } | null>({ key: "1 năm", span: "1 năm" });
  /*
   * The title follows the chosen date until someone writes their own — and is
   * worked out on each render rather than stored, so it also picks up the
   * partner's name when that arrives after the form opened (it read "Gửi
   * Người kia" for good when the name was still loading).
   */
  const [typedTitle, setTypedTitle] = useState<string | null>(null);
  const title = typedTitle ?? capsuleTitle(partnerName, choice ?? {});

  const utils = trpc.useUtils();
  const toast = useToast();
  const specialDates = trpc.specialDate.list.useQuery();
  const occasions = (specialDates.data ?? [])
    .filter((d) => d.daysUntil > 0 && d.daysUntil <= OCCASION_HORIZON_DAYS)
    .slice(0, OCCASIONS_SHOWN)
    .map((d) => ({ title: d.title, day: addDaysKey(today, d.daysUntil) }));

  const create = trpc.capsule.create.useMutation({
    onSuccess: () => {
      void utils.capsule.list.invalidate();
      toast("Đã giấu kín hộp thời gian!", "success");
      onDone();
    },
    onError: (err) => toast(readableFormError(err.message), "error"),
  });

  function pick(next: { key: string; span?: string; occasion?: string }, day: string) {
    setChoice(next);
    setUnlockDay(day);
  }

  function addLine(starter: string) {
    setMessage((m) => addStarter(m, starter));
    // Leave the caret at the end of the line just added, ready to finish it.
    requestAnimationFrame(() => {
      const el = document.getElementById("capsule-message") as HTMLTextAreaElement | null;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim() || !unlockDay || !unlockClock) return;
    create.mutate({ title: title.trim(), message, unlockDate: new Date(`${unlockDay}T${unlockClock}`) });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card mb-6 space-y-5 rounded-2xl border border-border p-5 shadow-sm" data-capsule-form>
      <h3 className="font-semibold">Tạo hộp thời gian mới 🎁</h3>

      <div className="space-y-2">
        <p className="text-muted-foreground text-sm font-medium">Mở khoá khi nào?</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Mở khoá sau">
          {UNLOCK_SPANS.map((s) => (
            <Chip
              key={s.label}
              label={s.label}
              selected={choice?.key === s.label}
              onClick={() => pick({ key: s.label, span: s.label }, addMonthsKey(today, s.months))}
              className="px-3"
            />
          ))}
          {occasions.map((o) => (
            <Chip
              key={`${o.title}-${o.day}`}
              label={
                <span className="max-w-[14rem] truncate">
                  {o.title} · {dayKeyLabel(o.day).slice(0, 5)}
                </span>
              }
              selected={choice?.key === o.title}
              onClick={() => pick({ key: o.title, occasion: o.title }, o.day)}
              className="max-w-full px-3"
            />
          ))}
        </div>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <DatePicker
              value={unlockDay}
              onChange={(d) => {
                setUnlockDay(d);
                setChoice(null);
              }}
              ariaLabel="Ngày mở khoá"
            />
          </div>
          <div className="w-32 shrink-0">
            <TimePicker value={unlockClock} onChange={setUnlockClock} />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="capsule-title" className="text-muted-foreground text-sm font-medium">Tiêu đề</label>
        <Input
          id="capsule-title"
          maxLength={100}
          placeholder="Vd: Thư gửi chồng 1 năm sau"
          value={title}
          onChange={(e) => setTypedTitle(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="capsule-message" className="text-muted-foreground text-sm font-medium">Thư</label>
        <Textarea
          id="capsule-message"
          placeholder="Viết tâm thư ở đây. Sẽ không ai đọc được cho đến ngày mở khóa..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="min-h-[120px]"
        />
        <div className="space-y-1.5">
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <PenLine className="h-3 w-3" aria-hidden="true" /> Chưa biết mở đầu? Bấm một câu:
          </p>
          {/* One row that scrolls sideways: five sentences wrapped took the height of the letter itself. */}
          <div className="relative -mx-5">
            <div className="flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]" role="group" aria-label="Câu mở đầu">
              {LETTER_STARTERS.map((s) => (
                <Chip key={s} label={<span className="whitespace-nowrap">{s}</span>} onClick={() => addLine(s)} className="shrink-0 px-3" />
              ))}
            </div>
            <div aria-hidden="true" className="from-card pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l to-transparent" />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>Hủy</Button>
        <Button
          type="submit"
          disabled={create.isPending || !title.trim() || !message.trim()}
          className="btn-sheen bg-accent text-white hover:bg-accent/90"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
          Khóa Lại
        </Button>
      </div>
    </form>
  );
}
