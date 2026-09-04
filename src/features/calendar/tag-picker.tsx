"use client";

import { useState } from "react";
import { readableInk } from "@/lib/plan-meta";
import { readableFormError } from "@/lib/form-error";
import { trpc } from "@/lib/trpc";
import { Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveIcon } from "@/lib/icon-registry";

import { useToast } from "@/components/ui/toast";

const QUICK_COLORS = ["#c2693f", "#e8a598", "#d4a373", "#a3b18a", "#cb997e", "#8a9bb0", "#b08bbd"];

/** Multi-select tag chips from the space palette + inline quick-add of a new tag. */
export function TagPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const tags = trpc.space.tags.useQuery();
  const addTag = trpc.space.addTag.useMutation({
    onSuccess: () => { utils.space.tags.invalidate(); toast("Đã thêm nhãn mới", "success"); },
    onError: (err) => toast(readableFormError(err.message), "error")
  });
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(QUICK_COLORS[0]);

  const toggle = (n: string) =>
    onChange(value.includes(n) ? value.filter((t) => t !== n) : [...value, n]);

  async function quickAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await addTag.mutateAsync({ name: trimmed, color });
    if (!value.includes(trimmed)) onChange([...value, trimmed]);
    setName("");
    setAdding(false);
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">
        (Tuỳ chọn) Nhãn giúp phân loại &amp; lọc; mỗi nhãn một màu hiện trên lịch.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {(tags.data ?? []).map((t) => {
          const on = value.includes(t.name);
          const TagIcon = t.icon ? resolveIcon(t.icon) : null;
          return (
            <button
              key={t.name}
              type="button"
              onClick={() => toggle(t.name)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                // Ink picked from the fill, same rule the read-side chip uses:
                // the two must not drift apart again.
                on ? "" : "bg-card text-foreground hover:bg-muted",
              )}
              style={
                on
                  ? { backgroundColor: t.color, borderColor: t.color, color: readableInk(t.color) }
                  : { borderColor: t.color }
              }
            >
              {on && <Check className="h-3 w-3" />}
              {TagIcon && <TagIcon className="h-3 w-3" />}
              {t.name}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="text-muted-foreground hover:bg-muted inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs"
        >
          <Plus className="h-3 w-3" /> Tag mới
        </button>
      </div>

      {adding && (
        <div className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-xl p-2">
          <input
            aria-label="Tên tag"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên tag"
            className="border-border bg-card h-9 flex-1 rounded-lg border px-2 text-sm outline-none"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), quickAdd())}
          />
          <div className="flex gap-1">
            {QUICK_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Màu ${c}`}
                className={cn("h-6 w-6 rounded-full", color === c && "ring-2 ring-offset-1 ring-foreground")}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            type="button"
            disabled={!name.trim() || addTag.isPending}
            onClick={quickAdd}
            className="bg-accent text-accent-foreground h-9 rounded-lg px-3 text-sm font-medium disabled:opacity-50"
          >
            Thêm
          </button>
        </div>
      )}
    </div>
  );
}
