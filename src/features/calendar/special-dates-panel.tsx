"use client";

import { useState } from "react";
import { readableFormError } from "@/lib/form-error";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ModalContent } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Trash2 } from "lucide-react";
import { dayKeyLabel, todayKey } from "@/lib/date-keys";
import { freshPresets, nextMonthDay, type DatePreset } from "@/lib/special-date-presets";
import { Chip } from "@/components/ui/chip";
import { resolveIcon } from "@/lib/icon-registry";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

// Registry keys available in the special-date icon picker.
// Subset chosen to cover the most common couple milestones.
const SPECIAL_DATE_ICON_KEYS = [
  "heart",
  "cake",
  "gift",
  "plane",
  "star",
  "sparkles",
  "calendar-days",
] as const;

type SpecialDateIconKey = (typeof SPECIAL_DATE_ICON_KEYS)[number];

const ICON_LABELS: Record<SpecialDateIconKey, string> = {
  heart: "Yêu thương",
  cake: "Sinh nhật",
  gift: "Kỷ niệm",
  plane: "Du lịch",
  star: "Cột mốc",
  sparkles: "Đặc biệt",
  "calendar-days": "Ngày trọng đại",
};

/*
 * A milestone, not a romance, unless the person says so.
 *
 * Every date created here used to arrive wearing a heart, which reads as a
 * claim about the relationship rather than about the date. "Cột mốc" says
 * only that something matters. The heart is still the first option in the
 * picker for anyone whose date really is one.
 */
const DEFAULT_ICON: SpecialDateIconKey = "star";

/** Manage recurring/one-off special dates (anniversary, birthdays…). */
export function SpecialDatesPanel() {
  const toast = useToast();
  const list = trpc.specialDate.list.useQuery();
  const utils = trpc.useUtils();
  const invalidate = () => {
    utils.specialDate.list.invalidate();
    void utils.calendar.nextUp.invalidate();
    utils.calendar.monthSummary.invalidate();
  };
  const create = trpc.specialDate.create.useMutation({
    onSuccess: () => { invalidate(); toast("Đã lưu ngày đặc biệt ✨", "success"); },
    onError: (err) => toast(readableFormError(err.message), "error"),
  });
  const remove = trpc.specialDate.remove.useMutation({
    // The row goes now; the server hears about it after. Waiting a round
    // trip before a confirmed delete takes effect reads as a dead button.
    onMutate: async ({ id }) => {
      await utils.specialDate.list.cancel();
      const prev = utils.specialDate.list.getData();
      utils.specialDate.list.setData(undefined, (old) => old?.filter((d) => d.id !== id));
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) utils.specialDate.list.setData(undefined, ctx.prev);
      toast(readableFormError(err.message), "error");
    },
    onSuccess: () => toast("Đã xoá ngày đặc biệt", "success"),
    onSettled: () => invalidate(),
  });

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayKey);
  const [iconKey, setIconKey] = useState<SpecialDateIconKey>(DEFAULT_ICON);
  const [recurYearly, setRecurYearly] = useState(true);

  function applyPreset(p: DatePreset) {
    setTitle(p.title);
    setRecurYearly(true);
    if ((SPECIAL_DATE_ICON_KEYS as readonly string[]).includes(p.icon)) setIconKey(p.icon as SpecialDateIconKey);
    if (p.monthDay) setDate(nextMonthDay(todayKey(), p.monthDay));
  }

  function add(e?: React.FormEvent) {
    e?.preventDefault();
    if (!title.trim() || create.isPending) return;
    create.mutate({ title: title.trim(), date, icon: iconKey, recurYearly });
    setTitle("");
    setIconKey(DEFAULT_ICON);
  }

  const items = list.data ?? [];
  const presets = freshPresets(items.map((d) => d.title));

  return (
    <ModalContent className="space-y-4">
      {/* Create form */}
      <form onSubmit={add} className="space-y-2" data-special-date-form>
        {presets.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium">Hay dùng — bấm để điền</p>
            {/* Two rows that scroll sideways on a phone; seven chips wrapped stood five rows tall. */}
            <div className="relative -mx-5">
              <div
                className="grid auto-cols-max grid-flow-col grid-rows-2 justify-items-start gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:flex md:flex-wrap md:overflow-visible"
                role="group"
                aria-label="Ngày hay dùng"
              >
                {presets.map((p) => (
                  <Chip
                    key={p.title}
                    icon={resolveIcon(p.icon)}
                    label={p.title}
                    selected={title === p.title}
                    onClick={() => applyPreset(p)}
                    className="px-3"
                  />
                ))}
              </div>
              <div aria-hidden="true" className="from-card pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l to-transparent md:hidden" />
            </div>
          </div>
        )}
        <Input
          aria-label="Tên ngày đặc biệt"
          placeholder="Tên ngày đặc biệt"
          maxLength={80}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <DatePicker value={date} onChange={setDate} ariaLabel="Ngày" />

        {/* Lucide icon picker — replaces the old emoji EMOJI[] array.
            Each option renders via resolveIcon() so it stays in the registry. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {SPECIAL_DATE_ICON_KEYS.map((key) => {
            const Icon = resolveIcon(key);
            const isActive = iconKey === key;
            const label = ICON_LABELS[key];
            return (
              <button
                key={key}
                type="button"
                aria-label={label}
                aria-pressed={isActive}
                title={label}
                onClick={() => setIconKey(key)}
                className={cn(
                  "rounded-lg p-1.5 transition-colors",
                  isActive
                    ? "bg-accent-soft ring-2 ring-accent"
                    : "hover:bg-muted",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    isActive ? "text-accent-ink" : "text-muted-foreground",
                  )}
                  strokeWidth={1.8}
                />
              </button>
            );
          })}
        </div>

        <div className="space-y-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              aria-label="Lặp lại hằng năm"
              type="checkbox"
              checked={recurYearly}
              onChange={(e) => setRecurYearly(e.target.checked)}
            />
            Lặp lại hàng năm
          </label>
          <p className="text-muted-foreground ml-5 text-xs">
            Bật: nhắc lại vào cùng ngày mỗi năm. Tắt: chỉ đếm ngược lần này.
          </p>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={!title.trim() || create.isPending}
        >
          {create.isPending ? "Đang thêm…" : "Thêm ngày đặc biệt"}
        </Button>
      </form>

      {/* List — EmptyState when empty */}
      <div className="space-y-2">
        {items.length === 0 ? (
          <EmptyState
            icon="calendar-heart"
            title="Chưa có ngày đặc biệt"
            subtitle="Thêm ngày đặc biệt (ngày gặp nhau, sinh nhật…) để app đếm ngược và nhắc bạn."
            className="py-8"
          />
        ) : (
          items.map((s) => {
            // Render via resolveIcon — handles both new registry keys and any
            // legacy emoji strings (resolveIcon falls back to MapPin for unknowns)
            const Icon = resolveIcon(s.icon ?? undefined);
            return (
              <div
                key={s.id}
                className="bg-card border-border flex items-center gap-2 rounded-xl border p-2.5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft">
                  <Icon className="h-4 w-4 text-accent-ink" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {dayKeyLabel(s.date)}
                    {s.recurYearly && " · hàng năm"}
                    {" · "}
                    {s.daysUntil === 0 ? "hôm nay" : `còn ${s.daysUntil} ngày`}
                  </p>
                </div>
                <ConfirmButton
                  idle=""
                  icon={<Trash2 className="h-4 w-4" />}
                  className="hover:bg-destructive-soft rounded-lg p-1.5"
                  onConfirm={() => remove.mutate({ id: s.id })}
                />
              </div>
            );
          })
        )}
      </div>
    </ModalContent>
  );
}
