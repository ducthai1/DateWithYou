"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { freshIdeas, type RewardIdea } from "@/lib/reward-ideas";

/**
 * The "add a task" / "add a voucher" row of Phiếu bé ngoan.
 *
 * It was a name box, a bare number box and a "+": what to write and what it
 * is worth were both up to whoever got there first. Now the worth is a few
 * chips on the panel's own scale, and the list it starts from is a row of
 * ideas — a tap fills both boxes, the "+" still decides. Ideas already on the
 * list drop out of the row.
 */
export function RewardQuickAdd({
  what,
  placeholder,
  ideas,
  presets,
  defaultPoints,
  taken,
  pending,
  onAdd,
}: {
  /** "nhiệm vụ" or "voucher" — names the controls for screen readers. */
  what: string;
  placeholder: string;
  ideas: RewardIdea[];
  presets: number[];
  defaultPoints: number;
  taken: string[];
  pending: boolean;
  onAdd: (title: string, points: number) => Promise<unknown>;
}) {
  const [title, setTitle] = useState("");
  const [points, setPoints] = useState(defaultPoints);
  const [otherOpen, setOtherOpen] = useState(false);
  const offered = freshIdeas(ideas, taken).slice(0, 8);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || pending) return;
    try {
      await onAdd(title.trim(), points || 1);
      setTitle("");
      setPoints(defaultPoints);
      setOtherOpen(false);
    } catch {
      // The panel's mutation already says what went wrong; keep what was typed.
    }
  }

  return (
    <form onSubmit={add} className="space-y-3" data-reward-add={what}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Input aria-label={`Tên ${what}`} placeholder={placeholder} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <Button type="submit" aria-label={`Thêm ${what}`} className="h-12 shrink-0 touch-manipulation gap-1 px-4" disabled={!title.trim() || pending}>
          <Plus className="h-4 w-4" /> Thêm
        </Button>
      </div>
      <div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={`Điểm của ${what}`}>
          {presets.map((p) => (
            <Chip key={p} label={`${p}đ`} selected={points === p && !otherOpen} onClick={() => { setPoints(p); setOtherOpen(false); }} className="px-3" />
          ))}
          {!presets.includes(points) && !otherOpen && <Chip label={`${points}đ`} selected className="px-3" />}
          <Chip label="Số khác" selected={otherOpen} onClick={() => setOtherOpen((o) => !o)} className="px-3" />
        </div>
      </div>
      {otherOpen && (
        <div className="max-w-[10rem]">
          <Input
            aria-label={`Số điểm khác của ${what}`}
            inputMode="numeric"
            value={String(points)}
            onChange={(e) => setPoints(Math.min(100_000, Number(e.target.value.replace(/\D/g, "")) || 0))}
            suffixIcon={<span className="text-muted-foreground text-sm" aria-hidden="true">đ</span>}
          />
        </div>
      )}
      {offered.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs font-medium">Gợi ý — bấm để điền</p>
          <div className="relative -mx-1">
            <div className="flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible">
              {offered.map((i) => (
                <Chip
                  key={i.title}
                  label={
                    <span className="whitespace-nowrap">
                      {i.title} <span className="opacity-70">· {i.points}đ</span>
                    </span>
                  }
                  selected={title === i.title && points === i.points}
                  onClick={() => {
                    setTitle(i.title);
                    setPoints(i.points);
                    setOtherOpen(false);
                  }}
                  className="shrink-0 px-3"
                />
              ))}
            </div>
            <div aria-hidden="true" className="from-card pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l to-transparent md:hidden" />
          </div>
        </div>
      )}
    </form>
  );
}
