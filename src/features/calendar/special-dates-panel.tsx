"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ModalContent } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Trash2 } from "lucide-react";
import { todayKey } from "@/lib/date-keys";
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
  "calendar-heart",
] as const;

type SpecialDateIconKey = (typeof SPECIAL_DATE_ICON_KEYS)[number];

const ICON_LABELS: Record<SpecialDateIconKey, string> = {
  heart: "Yêu thương",
  cake: "Sinh nhật",
  gift: "Kỷ niệm",
  plane: "Du lịch",
  star: "Cột mốc",
  sparkles: "Đặc biệt",
  "calendar-heart": "Ngày trọng đại",
};

const DEFAULT_ICON: SpecialDateIconKey = "heart";

/** Manage recurring/one-off special dates (anniversary, birthdays…). */
export function SpecialDatesPanel() {
  const toast = useToast();
  const list = trpc.specialDate.list.useQuery();
  const utils = trpc.useUtils();
  const invalidate = () => {
    utils.specialDate.list.invalidate();
    utils.calendar.monthSummary.invalidate();
  };
  const create = trpc.specialDate.create.useMutation({
    onSuccess: () => { invalidate(); toast("Đã lưu ngày đặc biệt 💖", "success"); },
    onError: (err) => toast(err.message, "error"),
  });
  const remove = trpc.specialDate.remove.useMutation({
    onSuccess: () => { invalidate(); toast("Đã xoá ngày đặc biệt", "success"); },
    onError: (err) => toast(err.message, "error"),
  });

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayKey);
  const [iconKey, setIconKey] = useState<SpecialDateIconKey>(DEFAULT_ICON);
  const [recurYearly, setRecurYearly] = useState(true);

  function add() {
    if (!title.trim()) return;
    create.mutate({ title: title.trim(), date, icon: iconKey, recurYearly });
    setTitle("");
    setIconKey(DEFAULT_ICON);
  }

  const items = list.data ?? [];

  return (
    <ModalContent className="space-y-4">
      {/* Create form */}
      <div className="space-y-2">
        <Input
          placeholder="Tên ngày đặc biệt"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <DatePicker value={date} onChange={setDate} />

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
                    isActive ? "text-accent" : "text-muted-foreground",
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
          className="w-full"
          disabled={!title.trim() || create.isPending}
          onClick={add}
        >
          {create.isPending ? "Đang thêm…" : "Thêm ngày đặc biệt"}
        </Button>
      </div>

      {/* List — EmptyState when empty */}
      <div className="space-y-2">
        {items.length === 0 ? (
          <EmptyState
            icon="calendar-heart"
            title="Chưa có ngày đặc biệt"
            subtitle="Thêm ngày đặc biệt (kỷ niệm yêu nhau, sinh nhật…) để app đếm ngược và nhắc bạn."
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
                  <Icon className="h-4 w-4 text-accent" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {s.date}
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
