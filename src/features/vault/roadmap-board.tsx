"use client";

import { useState } from "react";
import { readableFormError } from "@/lib/form-error";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StaggerList } from "@/components/ui/stagger-list";
import { Badge } from "@/components/ui/badge";
import { useCelebrate } from "@/components/ui/celebrate";
import { ArrowRight, GripVertical, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { PLAN_COLUMNS as COLUMNS, NEXT_STATUS, planCategoryIcon, type PlanStatus } from "./plan-board-meta";
import { PlanFormModal, type PlanDraft } from "./plan-form-modal";

export function RoadmapBoard() {
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  // A fresh form per opening; the old one stays mounted (closed) so it can animate out.
  const [formKey, setFormKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [draggedPlanId, setDraggedPlanId] = useState<string | null>(null);

  const list = trpc.plan.list.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const invalidate = () => utils.plan.list.invalidate();
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

  function openForm(next: PlanDraft) {
    setFormKey((k) => k + 1);
    setDraft(next);
    setFormOpen(true);
  }

  const openNewForm = (status: PlanStatus = "idea") =>
    openForm({ title: "", description: "", category: "", status });

  const openEditForm = (plan: typeof plans[number]) =>
    openForm({
      id: plan.id,
      title: plan.title,
      description: plan.description ?? "",
      category: plan.category ?? "",
      status: plan.status,
    });

  const titles = plans.map((p) => p.title);
  const usedCategories = [...new Set(plans.map((p) => p.category).filter((c): c is string => !!c))];

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
        <p className="text-muted-foreground text-sm">Những điều muốn cùng nhau làm, chưa cần gắn ngày: từ Ý tưởng → Đang lên kế hoạch → Đã làm. Bấm vào thẻ để sửa hoặc chuyển cột.</p>
        <Button onClick={() => openNewForm()} className="shrink-0 gap-1.5 w-full sm:w-auto" variant="primary">
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
                <button
                  type="button"
                  onClick={() => openNewForm(col.key)}
                  aria-label={`Thêm vào ${col.label}`}
                  title={`Thêm vào ${col.label}`}
                  className="text-muted-foreground hover:bg-background/80 hover:text-foreground -my-1 -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {colPlans.length === 0 ? (
                <EmptyState
                  icon="heart"
                  spot={col.spot}
                  title="Trống"
                  subtitle={col.key === "idea" ? "Bấm + để thêm một ý tưởng, có sẵn gợi ý để chọn." : "Bấm + để thêm, hoặc chuyển thẻ từ cột bên cạnh sang."}
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
                          {p.category && (() => {
                            const KindIcon = planCategoryIcon(p.category);
                            return (
                              <Badge tone="accent" className="mb-1.5 inline-flex max-w-full w-fit items-center gap-1">
                                {KindIcon && <KindIcon className="h-3 w-3 shrink-0" aria-hidden="true" />}
                                <span className="truncate">{p.category}</span>
                              </Badge>
                            );
                          })()}
                          <h4 className={`font-medium leading-tight [overflow-wrap:anywhere] ${p.status === "done" ? "text-muted-foreground line-through" : ""}`}>
                            {p.title}
                          </h4>
                        </div>
                        <div className="text-muted-foreground cursor-grab hover:text-foreground shrink-0" onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}>
                          <GripVertical className="h-4 w-4" />
                        </div>
                      </div>

                      {p.description && (
                        <p className="text-muted-foreground line-clamp-2 text-xs [overflow-wrap:anywhere]">
                          {p.description}
                        </p>
                      )}

                      <div className="mt-1 flex items-center justify-between gap-x-2 border-t border-border/50 pt-3">
                        <p className="text-muted-foreground min-w-0 text-[10px]" title={p.createdAt?.toString()}>
                          {p.createdAt ? formatDistanceToNow(p.createdAt, { locale: vi, addSuffix: true }) : ""}
                        </p>
                        <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}>
                          {NEXT_STATUS[p.status] && (
                            <button
                              type="button"
                              data-plan-advance
                              onClick={(e) => handleStatusChange(p.id, NEXT_STATUS[p.status]!.to, e.currentTarget)}
                              className="text-accent-ink hover:bg-accent-soft inline-flex min-h-[36px] shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-xs font-medium transition-colors"
                            >
                              {NEXT_STATUS[p.status]!.label} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          )}
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

      {draft && (
        <PlanFormModal
          key={formKey}
          open={formOpen}
          draft={draft}
          boardTitles={titles}
          usedCategories={usedCategories}
          onClose={() => setFormOpen(false)}
          onSaved={(movedToDone) => {
            setFormOpen(false);
            if (movedToDone) celebrate();
          }}
        />
      )}
    </div>
  );
}
