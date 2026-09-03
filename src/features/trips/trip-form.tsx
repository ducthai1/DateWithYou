"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { todayKey } from "@/lib/date-keys";
import type { TripStatus } from "@/lib/trip-status";
import { TripStatusChips } from "./trip-status-control";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

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
    status: TripStatus;
  };
  onSuccess: () => void;
}) {
  const ctx = trpc.useUtils();
  const router = useRouter();
  const [title, setTitle] = useState(trip?.title ?? "");
  const [description, setDescription] = useState(trip?.description ?? "");
  const [startDate, setStartDate] = useState(trip?.startDate ?? todayKey());
  const [endDate, setEndDate] = useState(trip?.endDate ?? todayKey());
  const [budget, setBudget] = useState(trip?.budget?.toString() ?? "0");

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

  const removeMut = trpc.trip.remove.useMutation({
    onSuccess: () => {
      ctx.trip.list.invalidate();
      onSuccess();
      router.push("/trips");
    },
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
        budget: Number(budget) || 0,
      });
    } else {
      createMut.mutate({
        title: title.trim(),
        description: description.trim() || undefined,
        startDate,
        endDate,
        budget: Number(budget) || 0,
      });
    }
  };

  const isPending = createMut.isPending || updateMut.isPending || removeMut.isPending;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0 w-full">
      <ModalContent className="flex flex-col gap-4">
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
            <input
              aria-label="Ngày bắt đầu"
              required
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2 text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Đến ngày</label>
            <input
              aria-label="Ngày kết thúc"
              required
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2 text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">Ngân sách dự kiến (VNĐ)</label>
          <input
            aria-label="Ngân sách dự kiến"
            type="number"
            min={0}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-border bg-background px-4 py-2 text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Status is not a form field any more. It changed several times over
            a trip's life while living three taps deep in here, so it moved out
            to the trip card and the trip header as a one-tap control. Editing
            still shows it — as that same control, writing immediately — so the
            two places can never disagree about what the trip's state is. A new
            trip has no id to write to, and is being prepared by definition; a
            trip logged after the fact gets an offer to close it from the dates
            themselves. */}
        {trip && (
          <div>
            <label className="text-muted-foreground mb-1 block text-sm font-medium">
              Trạng thái
            </label>
            <TripStatusChips tripId={trip.id} status={trip.status} />
          </div>
        )}

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
