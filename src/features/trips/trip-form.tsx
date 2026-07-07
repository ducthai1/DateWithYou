"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { todayKey } from "@/lib/date-keys";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { ModalContent, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

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
    status: "planning" | "upcoming" | "completed";
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
  const [status, setStatus] = useState(trip?.status ?? "planning");

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

  const handleDelete = () => {
    if (!trip) return;
    if (window.confirm("Bạn có chắc muốn xóa chuyến đi này không? Mọi dữ liệu lịch trình sẽ bị mất.")) {
      removeMut.mutate({ id: trip.id });
    }
  };

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
        status,
      });
    } else {
      createMut.mutate({
        title: title.trim(),
        description: description.trim() || undefined,
        startDate,
        endDate,
        budget: Number(budget) || 0,
        status,
      });
    }
  };

  const isPending = createMut.isPending || updateMut.isPending || removeMut.isPending;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <ModalContent className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">Tên chuyến đi</label>
          <input
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
            type="number"
            min={0}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-border bg-background px-4 py-2 text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">Trạng thái</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "planning" | "upcoming" | "completed")}
            className="w-full rounded-xl border border-border bg-background px-4 py-2 text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="planning">Đang lên kế hoạch</option>
            <option value="upcoming">Sắp khởi hành</option>
            <option value="completed">Đã hoàn thành</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">Ghi chú thêm</label>
          <textarea
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
            onClick={handleDelete}
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
    </form>
  );
}
