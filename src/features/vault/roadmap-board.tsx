"use client";

import { useState } from "react";
import { readableFormError } from "@/lib/form-error";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StaggerList } from "@/components/ui/stagger-list";
import { Modal, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useCelebrate } from "@/components/ui/celebrate";
import { CheckCircle2, GripVertical, Lightbulb, Map, Plus, Target, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

type PlanStatus = "idea" | "planning" | "done";

const COLUMNS = [
  // spot: a wide scene here would crop to a smear at 1/3-column width (md+),
  // so each empty column gets a spot illustration picked for what the status
  // means instead — a daydream, a booked plan, a trip already made.
  { key: "idea" as const, label: "Ý tưởng", icon: Lightbulb, bg: "bg-amber-500/10 border-amber-500/20", iconColor: "text-amber-600", spot: "islandCampsite" as const },
  { key: "planning" as const, label: "Đang lên kế hoạch", icon: Map, bg: "bg-sky-500/10 border-sky-500/20", iconColor: "text-sky-600", spot: "pinTicket" as const },
  { key: "done" as const, label: "Đã làm", icon: CheckCircle2, bg: "bg-emerald-500/10 border-emerald-500/20", iconColor: "text-emerald-600", spot: "backpackScrapbook" as const },
];

export function RoadmapBoard() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draggedPlanId, setDraggedPlanId] = useState<string | null>(null);
  
  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

  const list = trpc.plan.list.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const invalidate = () => utils.plan.list.invalidate();
  const create = trpc.plan.create.useMutation({ 
    onSuccess: () => { closeForm(); invalidate(); toast("Đã thêm dự định mới!", "success"); },
    onError: (err) => toast(readableFormError(err.message), "error")
  });
  const update = trpc.plan.update.useMutation({ 
    onSuccess: () => { closeForm(); invalidate(); toast("Đã cập nhật dự định!", "success"); },
    onError: (err) => toast(readableFormError(err.message), "error")
  });
  const setStatus = trpc.plan.setStatus.useMutation({
    onMutate: async ({ id, status }) => {
      await utils.plan.list.cancel();
      const previous = utils.plan.list.getData();
      if (previous) {
        utils.plan.list.setData(undefined, previous.map(p => p.id === id ? { ...p, status } : p));
      }
      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        utils.plan.list.setData(undefined, context.previous);
      }
      toast("Lỗi khi chuyển trạng thái: " + readableFormError(err.message), "error");
    },
    onSettled: () => {
      invalidate();
    },
    onSuccess: (_, variables) => {
      const statusLabel = COLUMNS.find(c => c.key === variables.status)?.label || "trạng thái mới";
      toast(`Đã chuyển sang "${statusLabel}"`, "success");
    }
  });
  const remove = trpc.plan.remove.useMutation({ 
    onSuccess: () => { invalidate(); toast("Đã xóa dự định!", "success"); },
    onError: (err) => toast(readableFormError(err.message), "error")
  });

  const celebrate = useCelebrate();

  const plans = list.data ?? [];

  function openNewForm() {
    setTitle("");
    setDescription("");
    setCategory("");
    setEditingId(null);
    setFormOpen(true);
  }

  function openEditForm(plan: typeof plans[number]) {
    setTitle(plan.title);
    setDescription(plan.description ?? "");
    setCategory(plan.category ?? "");
    setEditingId(plan.id);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setTimeout(() => {
      setTitle("");
      setDescription("");
      setCategory("");
      setEditingId(null);
    }, 200);
  }

  function saveForm() {
    if (!title.trim()) return;
    if (editingId) {
      update.mutate({ id: editingId, title, description, category });
    } else {
      create.mutate({ title, description, category });
    }
  }

  function handleStatusChange(id: string, newStatus: PlanStatus, anchorEl?: HTMLElement | null) {
    setStatus.mutate({ id, status: newStatus });
    if (newStatus === "done") {
      celebrate(anchorEl);
    }
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggedPlanId(id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent, status: PlanStatus) {
    e.preventDefault();
    if (!draggedPlanId) return;
    const plan = plans.find((p) => p.id === draggedPlanId);
    if (plan && plan.status !== status) {
      handleStatusChange(draggedPlanId, status, e.currentTarget as HTMLElement);
    }
    setDraggedPlanId(null);
  }


  /*
   * Guard the render on fetch state BEFORE falling through to the list.
   * `list.data ?? []` made an in-flight fetch indistinguishable from a genuinely
   * empty space, so every visit flashed an empty state over the couple's real
   * content - and a failed fetch showed the same thing permanently, reading as
   * "our data is gone" rather than "we are offline".
   */
  if (list.isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    );
  }

  if (list.isError) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-3 py-16 text-center text-sm">
        <p>Chưa tải được dữ liệu. Kiểm tra kết nối rồi thử lại nhé.</p>
        <Button variant="secondary" onClick={() => void list.refetch()} disabled={list.isRefetching}>
          {list.isRefetching ? "Đang tải…" : "Thử lại"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">Lên kế hoạch những dự định cùng nhau: từ Ý tưởng → Đang lên kế hoạch → Đã làm. Kéo thả thẻ để đổi trạng thái. (Khác Lịch: đây là bucket planning, không gắn ngày cụ thể.)</p>
        <Button onClick={openNewForm} className="shrink-0 gap-1.5 w-full sm:w-auto" variant="primary">
          <Plus className="h-4 w-4" /> Thêm dự định
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3 md:items-start">
        {COLUMNS.map((col) => {
          const colPlans = plans.filter((p) => p.status === col.key);
          const Icon = col.icon;
          
          return (
            <section 
              key={col.key} 
              className={`flex flex-col gap-3 rounded-2xl border p-4 transition-colors ${col.bg} ${draggedPlanId ? "ring-2 ring-accent/20" : ""}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              <div className="flex items-center gap-2 border-b border-border/50 pb-3">
                <Icon className={`h-4 w-4 ${col.iconColor}`} />
                <h3 className="font-semibold text-foreground/90">{col.label}</h3>
                <span className="bg-background/80 text-muted-foreground ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium shadow-sm">
                  {colPlans.length}
                </span>
              </div>

              {colPlans.length === 0 ? (
                <EmptyState
                  icon="heart"
                  spot={col.spot}
                  title="Trống"
                  subtitle={col.key === "idea" ? "Thêm dự định mới hoặc kéo thả thẻ vào đây." : "Kéo thả thẻ vào đây để chuyển trạng thái."}
                  className="py-10"
                />
              ) : (
                <StaggerList gap="space-y-3">
                  {colPlans.map((p) => (
                    <Card
                      key={p.id}
                      interactive
                      draggable
                      onDragStart={(e) => handleDragStart(e, p.id)}
                      onDragEnd={() => setDraggedPlanId(null)}
                      onClick={() => openEditForm(p)}
                      className={`group flex flex-col gap-3 p-4 hover:border-accent/40 cursor-grab active:cursor-grabbing ${draggedPlanId === p.id ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {p.category && (
                            <Badge tone="accent" className="mb-1.5 line-clamp-1 w-fit">{p.category}</Badge>
                          )}
                          <h4 className={`font-medium leading-tight ${p.status === "done" ? "text-muted-foreground line-through" : ""}`}>
                            {p.title}
                          </h4>
                        </div>
                        <div className="text-muted-foreground cursor-grab hover:text-foreground shrink-0" onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}>
                          <GripVertical className="h-4 w-4" />
                        </div>
                      </div>

                      {p.description && (
                        <p className="text-muted-foreground line-clamp-2 text-xs">
                          {p.description}
                        </p>
                      )}

                      <div className="mt-1 flex items-center justify-between gap-x-2 border-t border-border/50 pt-3">
                        <p className="text-muted-foreground text-[10px]" title={p.createdAt?.toString()}>
                          {p.createdAt ? formatDistanceToNow(p.createdAt, { locale: vi, addSuffix: true }) : ""}
                        </p>
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}>
                          <ConfirmButton
                            idle=""
                            confirmText="Xoá"
                            icon={<Trash2 className="h-4 w-4" />}
                            className="rounded-lg px-2 py-1.5 hover:bg-destructive-soft opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 shrink-0"
                            onConfirm={() => remove.mutate({ id: p.id })}
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </StaggerList>
              )}
            </section>
          );
        })}
      </div>

      <Modal open={formOpen} onClose={closeForm}>
        <ModalHeader
          title={editingId ? "Chỉnh sửa dự định" : "Thêm dự định mới"}
          description="Nơi muốn tới, việc muốn làm — chưa cần gắn ngày cụ thể."
          icon={<Target className="h-[18px] w-[18px]" />}
          onClose={closeForm}
        />
        <ModalContent className="space-y-4">
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Tiêu đề</label>
            <Input 
              autoFocus 
              placeholder="VD: Du lịch Đà Lạt mùa mưa" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Phân loại (tùy chọn)</label>
            <Input 
              placeholder="VD: Du lịch, Mua sắm, Trải nghiệm..." 
              value={category} 
              onChange={(e) => setCategory(e.target.value)} 
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Mô tả chi tiết</label>
            <Textarea
              rows={3}
              placeholder="Ghi chú thêm về dự định này..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="secondary" className="flex-1" onClick={closeForm}>Huỷ</Button>
          <Button variant="primary" className="flex-1" disabled={!title.trim() || create.isPending || update.isPending} onClick={saveForm}>
            {editingId ? "Cập nhật" : "Thêm vào kế hoạch"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
