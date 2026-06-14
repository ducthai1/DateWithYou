"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ModalContent } from "@/components/ui/modal";
import { Trash2 } from "lucide-react";
import { todayKey } from "@/lib/date-keys";

const EMOJI = ["💞", "🎂", "💍", "🌹", "✈️", "🎉", "⭐"];

/** Manage recurring/one-off special dates (anniversary, birthdays…). */
export function SpecialDatesPanel() {
  const list = trpc.specialDate.list.useQuery();
  const utils = trpc.useUtils();
  const invalidate = () => {
    utils.specialDate.list.invalidate();
    utils.calendar.monthSummary.invalidate();
  };
  const create = trpc.specialDate.create.useMutation({ onSuccess: invalidate });
  const remove = trpc.specialDate.remove.useMutation({ onSuccess: invalidate });

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayKey);
  const [icon, setIcon] = useState(EMOJI[0]);
  const [recurYearly, setRecurYearly] = useState(true);

  function add() {
    if (!title.trim()) return;
    create.mutate({ title: title.trim(), date, icon, recurYearly });
    setTitle("");
  }

  return (
    <ModalContent className="space-y-4">
      <div className="space-y-2">
        <Input placeholder="Tên ngày đặc biệt" value={title} onChange={(e) => setTitle(e.target.value)} />
        <DatePicker value={date} onChange={setDate} />
        <div className="flex flex-wrap items-center gap-1.5">
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setIcon(e)}
              className={`rounded-lg p-1.5 text-lg ${icon === e ? "bg-accent-soft ring-2 ring-accent" : "hover:bg-muted"}`}
            >
              {e}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={recurYearly} onChange={(e) => setRecurYearly(e.target.checked)} />
          Lặp lại hàng năm
        </label>
        <Button className="w-full" disabled={!title.trim() || create.isPending} onClick={add}>
          {create.isPending ? "Đang thêm…" : "Thêm ngày đặc biệt"}
        </Button>
      </div>

      <div className="space-y-2">
        {(list.data ?? []).map((s) => (
          <div key={s.id} className="bg-card border-border flex items-center gap-2 rounded-xl border p-2.5">
            <span className="text-xl">{s.icon ?? "💞"}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{s.title}</p>
              <p className="text-muted-foreground text-xs">
                {s.date} {s.recurYearly && "· hàng năm"} · {s.daysUntil === 0 ? "hôm nay" : `còn ${s.daysUntil} ngày`}
              </p>
            </div>
            <ConfirmButton
              idle=""
              icon={<Trash2 className="h-4 w-4" />}
              className="hover:bg-destructive-soft rounded-lg p-1.5"
              onConfirm={() => remove.mutate({ id: s.id })}
            />
          </div>
        ))}
        {(list.data ?? []).length === 0 && (
          <p className="text-muted-foreground text-center text-xs">Chưa có ngày đặc biệt nào.</p>
        )}
      </div>
    </ModalContent>
  );
}
