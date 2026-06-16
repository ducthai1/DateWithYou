"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerList } from "@/components/ui/stagger-list";
import { Modal, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useCelebrate } from "@/components/ui/celebrate";
import { Trash2, Plus, Lightbulb, Map, CheckCircle2 } from "lucide-react";

type PlanStatus = "idea" | "planning" | "done";

const COLUMNS = [
  { key: "idea" as const, label: "Ý tưởng", icon: Lightbulb },
  { key: "planning" as const, label: "Đang lên kế hoạch", icon: Map },
  { key: "done" as const, label: "Đã làm", icon: CheckCircle2 },
];

export function RoadmapBoard() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  
  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

  const list = trpc.plan.list.useQuery();
  const utils = trpc.useUtils();
  const invalidate = () => utils.plan.list.invalidate();
  const create = trpc.plan.create.useMutation({ onSuccess: () => { closeForm(); invalidate(); } });
  const update = trpc.plan.update.useMutation({ onSuccess: () => { closeForm(); invalidate(); } });
  const setStatus = trpc.plan.setStatus.useMutation({ onSuccess: invalidate });
  const remove = trpc.plan.remove.useMutation({ onSuccess: invalidate });

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">Cùng nhau lên kế hoạch cho những dự định tương lai.</p>
        <Button onClick={openNewForm} className="shrink-0 gap-1.5" variant="primary">
          <Plus className="h-4 w-4" /> Thêm dự định
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3 md:items-start">
        {COLUMNS.map((col) => {
          const colPlans = plans.filter((p) => p.status === col.key);
          const Icon = col.icon;
          
          return (
            <section key={col.key} className="flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Icon className="text-accent h-4 w-4" />
                <h3 className="font-semibold">{col.label}</h3>
                <span className="bg-muted text-muted-foreground ml-auto rounded-full px-2 py-0.5 text-xs font-medium">
                  {colPlans.length}
                </span>
              </div>

              {colPlans.length === 0 ? (
                <EmptyState
                  icon="heart"
                  title="Trống"
                  className="py-10"
                />
              ) : (
                <StaggerList gap="space-y-3">
                  {colPlans.map((p) => (
                    <Card
                      key={p.id}
                      interactive
                      onClick={() => openEditForm(p)}
                      className="group flex flex-col gap-3 p-4 hover:border-accent/40"
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
                      </div>

                      {p.description && (
                        <p className="text-muted-foreground line-clamp-2 text-xs">
                          {p.description}
                        </p>
                      )}

                      <div className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-3">
                        <p className="text-muted-foreground text-[10px]" title={p.createdAt?.toString()}>
                          {p.createdAt ? formatDistanceToNow(p.createdAt, { locale: vi, addSuffix: true }) : ""}
                        </p>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <div className="w-36">
                            <Select
                              aria-label="Chuyển trạng thái"
                              value={p.status}
                              onChange={(val) => handleStatusChange(p.id, val as PlanStatus, null)}
                              options={COLUMNS.map((c) => ({
                                value: c.key,
                                label: c.label,
                              }))}
                              className="h-7 text-xs"
                            />
                          </div>
                          <ConfirmButton
                            idle=""
                            confirmText="Xoá"
                            icon={<Trash2 className="h-3.5 w-3.5" />}
                            className="rounded-lg px-2 py-1.5 hover:bg-destructive-soft opacity-0 transition-opacity group-hover:opacity-100"
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
        <ModalHeader title={editingId ? "Chỉnh sửa dự định" : "Thêm dự định mới"} onClose={closeForm} />
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
          <Button variant="ghost" onClick={closeForm}>Huỷ</Button>
          <Button variant="primary" disabled={!title.trim() || create.isPending || update.isPending} onClick={saveForm}>
            {editingId ? "Cập nhật" : "Thêm vào kế hoạch"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
