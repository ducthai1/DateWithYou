"use client";

import { useState } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { trpc } from "@/lib/trpc";
import { todayKey } from "@/lib/date-keys";
import { useRouter } from "next/navigation";
import { Target, Trash2 } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { MoneyInput } from "@/components/ui/money-input";
import { BUDGET_PRESETS, TRIP_LENGTHS, tripDays, tripEnd } from "@/lib/trip-presets";
import { guessPlanCategory } from "@/lib/plan-ideas";

import { ModalContent, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";

export function TripForm({
  trip,
  onSuccess,
}: {
  trip?: {
    id: string;
    title: string;
    description: string | null;
    startDate: string;
    endDate: string;
    budget: number;
  };
  onSuccess: () => void;
}) {
  const ctx = trpc.useUtils();
  const router = useRouter();
  const [title, setTitle] = useState(trip?.title ?? "");
  const [description, setDescription] = useState(trip?.description ?? "");
  const [startDate, setStartDate] = useState(trip?.startDate ?? todayKey());
  const [endDate, setEndDate] = useState(trip?.endDate ?? todayKey());
  // null is "not set yet", which the field shows as empty rather than a "0" to delete first.
  const [budget, setBudget] = useState<number | null>(trip?.budget ? trip.budget : null);
  // Their "Du lịch" plans from Bí mật — a trip is usually one of those coming true.
  const plans = trpc.plan.list.useQuery(undefined, { enabled: !trip });
  const fromPlans = (plans.data ?? [])
    .filter((p) => p.status !== "done" && (p.category === "Du lịch" || (!p.category && guessPlanCategory(p.title) === "Du lịch")))
    .slice(0, 4);

  const createMut = trpc.trip.create.useMutation({
    onSuccess: () => {
      ctx.trip.list.invalidate();
      onSuccess();
    },
  });

  const updateMut = trpc.trip.update.useMutation({
    onSuccess: (data) => {
      ctx.trip.list.invalidate();
      ctx.trip.get.invalidate({ id: data.id });
      onSuccess();
    },
  });

  /*
   * Drop the trip from the list before leaving the page.
   *
   * `invalidate` marks the list stale and refetches; it does not forget what
   * it holds. So deleting a trip and landing on /trips showed the trip that
   * had just been deleted, for as long as the refetch took — which reads as
   * "the delete did not work" and invites a second attempt at something that
   * has already happened.
   */
  const removeMut = trpc.trip.remove.useMutation({
    onMutate: async ({ id }) => {
      await ctx.trip.list.cancel();
      const prev = ctx.trip.list.getData();
      ctx.trip.list.setData(undefined, (old) => old?.filter((t) => t.id !== id));
      return { prev };
    },
    onError: (_e, _v, context) => {
      if (context?.prev) ctx.trip.list.setData(undefined, context.prev);
    },
    onSuccess: () => {
      onSuccess();
      router.push("/trips");
    },
    onSettled: () => ctx.trip.list.invalidate(),
  });

  /*
   * Asked in a dialog, not through window.confirm().
   *
   * The native box is system chrome: it ignores the app's type and colour, has
   * no way to mark which of its two answers destroys something, and on iOS puts
   * the site's hostname above the question. Every other destructive action here
   * already asks in the app's own voice; this was the one that did not.
   */
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate) return;

    if (trip) {
      updateMut.mutate({
        id: trip.id,
        title: title.trim(),
        description: description.trim() || undefined,
        startDate,
        endDate,
        budget: budget ?? 0,
      });
    } else {
      createMut.mutate({
        title: title.trim(),
        description: description.trim() || undefined,
        startDate,
        endDate,
        budget: budget ?? 0,
      });
    }
  };

  const isPending = createMut.isPending || updateMut.isPending || removeMut.isPending;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0 w-full">
      <ModalContent className="flex flex-col gap-4">
        {fromPlans.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium">Từ kế hoạch của hai bạn</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Từ kế hoạch">
              {fromPlans.map((p) => (
                <Chip
                  key={p.id}
                  icon={Target}
                  label={<span className="max-w-[14rem] truncate">{p.title}</span>}
                  selected={title === p.title}
                  onClick={() => {
                    setTitle(p.title);
                    if (!description.trim() && p.description) setDescription(p.description);
                  }}
                  className="max-w-full px-3"
                />
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">Tên chuyến đi</label>
          <input
            aria-label="Tên chuyến đi"
            required
            autoFocus
            maxLength={100}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Đà Lạt 4 ngày 3 đêm"
            className="w-full rounded-xl border border-border bg-background px-4 py-2 text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Từ ngày</label>
            {/* Shared DatePicker: day-first and unambiguous, icon leading — the
                native field printed the browser's own order and drew its icon
                against the right edge. Moving the start carries the end with
                it, so a "3N2Đ" picked first stays three days wherever the trip
                moves, and the range can never be inverted. */}
            <DatePicker
              value={startDate}
              onChange={(d) => {
                setStartDate(d);
                setEndDate(tripEnd(d, tripDays(startDate, endDate)));
              }}
              ariaLabel="Ngày bắt đầu"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Đến ngày</label>
            <DatePicker
              value={endDate}
              onChange={(d) => setEndDate(d < startDate ? startDate : d)}
              ariaLabel="Ngày kết thúc"
            />
          </div>
        </div>
        <div className="-mt-1 flex flex-wrap gap-2" role="group" aria-label="Độ dài chuyến đi">
          {TRIP_LENGTHS.map((l) => (
            <Chip
              key={l.label}
              label={l.label}
              selected={tripDays(startDate, endDate) === l.days}
              onClick={() => setEndDate(tripEnd(startDate, l.days))}
              className="px-3"
            />
          ))}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">Ngân sách dự kiến</label>
          <MoneyInput value={budget} onChange={setBudget} presets={BUDGET_PRESETS} ariaLabel="Ngân sách dự kiến" placeholder="Chưa tính" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">Ghi chú thêm</label>
          <textarea
            aria-label="Mô tả chuyến đi"
            rows={3}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Một vài dòng giới thiệu về chuyến đi..."
            className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2 text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </ModalContent>
      
      <ModalFooter>
        {trip && (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={() => setConfirmDelete(true)}
            disabled={isPending}
            className="mr-2 shrink-0"
            title="Xóa chuyến đi"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        )}
        <Button type="button" variant="secondary" className="flex-1" onClick={onSuccess} disabled={isPending}>
          Hủy
        </Button>
        <Button type="submit" className="flex-1" disabled={isPending}>
          {trip ? "Lưu thay đổi" : "Tạo chuyến đi"}
        </Button>
      </ModalFooter>

      {/* Sits above the edit dialog it was opened from — the shared shell
          stacks, so the form stays visible and untouched behind it. */}
      {trip && (
        <ConfirmModal
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => removeMut.mutate({ id: trip.id })}
          pending={removeMut.isPending}
          tone="danger"
          title="Xoá chuyến đi này?"
          message={`"${trip.title}" và toàn bộ lịch trình, hành trang, chi phí của nó sẽ bị xoá. Không thể hoàn lại.`}
          confirmLabel="Xoá chuyến đi"
        />
      )}
    </form>
  );
}
