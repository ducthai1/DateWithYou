"use client";

import { useEffect, useRef, useState } from "react";
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

  /*
   * Ticking an item moves the tick NOW and tells the server afterwards.
   *
   * It used to await the mutation and then refetch the whole trip before the
   * circle filled in, so every tap cost two round trips of nothing happening —
   * and tapping several things in a row queued that up again for each one.
   *
   * So: patch the cached trip on the tap, and send the item's settled state
   * 400ms after the tapping stops. Sending the state rather than a toggle is
   * what makes a double tap safe — the request says what the item should BE,
   * so arriving twice or out of order lands in the same place.
   */
  const toggleMut = trpc.trip.toggleChecklist.useMutation({
    onError: () => toast("Chưa lưu được, thử lại nhé", "error"),
  });

  const SETTLE_MS = 400;
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const beforeBurst = useRef<ReturnType<typeof ctx.trip.get.getData> | undefined>(undefined);

  function flush(checklistId: string) {
    timers.current.delete(checklistId);
    const now = ctx.trip.get.getData({ id: trip.id });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item = (now as any)?.checklists?.find((c: any) => c.id === checklistId);
    if (!item) return;
    const rollback = beforeBurst.current;
    if (timers.current.size === 0) beforeBurst.current = undefined;
    toggleMut.mutate(
      { tripId: trip.id, checklistId, isDone: item.isDone },
      {
        // Back to where the list stood before the whole burst, not before the
        // last tap: one rejected write invalidates every tick in it.
        onError: () => rollback && ctx.trip.get.setData({ id: trip.id }, rollback),
        onSettled: () => { if (timers.current.size === 0) ctx.trip.get.invalidate({ id: trip.id }); },
      },
    );
  }

  // Leaving the page right after a tap must not drop it — send what is pending
  // rather than clearing the timers and losing the change.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const [id, t] of pending) { clearTimeout(t); flush(id); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function toggleItem(item: any) {
    const prev = ctx.trip.get.getData({ id: trip.id });
    if (!prev) return;
    if (!beforeBurst.current) beforeBurst.current = prev;
    ctx.trip.get.setData({ id: trip.id }, {
      ...prev,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      checklists: (prev as any).checklists.map((c: any) =>
        c.id === item.id ? { ...c, isDone: !c.isDone } : c,
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const running = timers.current.get(item.id);
    if (running) clearTimeout(running);
    timers.current.set(item.id, setTimeout(() => flush(item.id), SETTLE_MS));
  }

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
              onClick={() => toggleItem(item)}
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
