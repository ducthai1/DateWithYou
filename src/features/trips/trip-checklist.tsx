"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/components/ui/toast";
import { Check, Plus, Trash2 } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TripChecklist({ trip }: { trip: any }) {
  const ctx = trpc.useUtils();
  const toast = useToast();
  const [newItem, setNewItem] = useState("");

  const addMut = trpc.trip.addChecklist.useMutation({
    onSuccess: () => {
      ctx.trip.get.invalidate({ id: trip.id });
      setNewItem("");
    },
    onError: () => toast("Chưa thêm được, thử lại nhé", "error"),
  });

  const toggleMut = trpc.trip.toggleChecklist.useMutation({
    onSuccess: () => ctx.trip.get.invalidate({ id: trip.id }),
    onError: () => toast("Chưa lưu được, thử lại nhé", "error"),
  });

  const removeMut = trpc.trip.removeChecklist.useMutation({
    onSuccess: () => ctx.trip.get.invalidate({ id: trip.id }),
    onError: () => toast("Chưa xoá được, thử lại nhé", "error"),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    addMut.mutate({ tripId: trip.id, content: newItem.trim() });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doneCount = trip.checklists.filter((c: any) => c.isDone).length;
  const totalCount = trip.checklists.length;
  const progress = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  return (
    <div className="flex flex-col gap-6">
      {/* Progress */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-sm font-medium">
          <span>Tiến độ chuẩn bị</span>
          <span className="text-accent">{progress}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-accent transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Đã chuẩn bị {doneCount}/{totalCount} mục.
        </p>
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {trip.checklists.map((item: any) => (
          <div
            key={item.id}
            className={`group flex items-start gap-3 rounded-xl border p-3 transition-colors ${
              item.isDone ? "border-transparent bg-muted/50" : "border-border bg-card shadow-sm"
            }`}
          >
            <button
              onClick={() => toggleMut.mutate({ tripId: trip.id, checklistId: item.id, isDone: !item.isDone })}
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                item.isDone ? "border-accent bg-accent text-accent-foreground" : "border-muted-foreground/30 bg-background"
              }`}
            >
              {item.isDone && <Check className="h-4 w-4" />}
            </button>
            
            <div className="flex flex-1 flex-col justify-center">
              <span className={`text-sm ${item.isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>
                {item.content}
              </span>
            </div>

            <button
              onClick={() => removeMut.mutate({ tripId: trip.id, checklistId: item.id })}
              className="text-muted-foreground hover:text-destructive focus-visible:ring-ring/50 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2 md:opacity-60 md:group-hover:opacity-100"
              aria-label={`Xoá "${item.content}"`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add New */}
      <form onSubmit={handleAdd} className="relative mt-2">
        <input
          aria-label="Thêm mục cần chuẩn bị"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Thêm mục cần chuẩn bị..."
          className="w-full rounded-full border border-border bg-card py-3 pl-5 pr-12 text-sm text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={!newItem.trim() || addMut.isPending}
          className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          <Plus className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
