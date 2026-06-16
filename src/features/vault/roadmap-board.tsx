"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerList } from "@/components/ui/stagger-list";
import { Trash2 } from "lucide-react";

const COLUMNS = [
  { key: "idea", label: "Ý tưởng" },
  { key: "planning", label: "Đang lên kế hoạch" },
  { key: "done", label: "Đã làm" },
] as const;

export function RoadmapBoard() {
  const [title, setTitle] = useState("");
  const list = trpc.plan.list.useQuery();
  const utils = trpc.useUtils();
  const invalidate = () => utils.plan.list.invalidate();
  const create = trpc.plan.create.useMutation({ onSuccess: () => { setTitle(""); invalidate(); } });
  const setStatus = trpc.plan.setStatus.useMutation({ onSuccess: invalidate });
  const remove = trpc.plan.remove.useMutation({ onSuccess: invalidate });

  const plans = list.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="Dự định mới (vd: Du lịch Đà Lạt)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button disabled={!title.trim() || create.isPending} onClick={() => create.mutate({ title: title.trim() })}>
          Thêm
        </Button>
      </div>
      {COLUMNS.map((col) => (
        <section key={col.key}>
          <h3 className="text-muted-foreground mb-2 text-sm font-medium">{col.label}</h3>
          {plans.filter((p) => p.status === col.key).length === 0 ? (
            <EmptyState
              icon="heart"
              title="Chưa có gì"
              subtitle="Thêm dự định mới vào đây."
              className="py-6"
            />
          ) : (
            <StaggerList gap="space-y-2">
              {plans.filter((p) => p.status === col.key).map((p) => (
                <Card key={p.id} className="flex items-center justify-between gap-2 p-3">
                  <span className="truncate text-sm">{p.title}</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <div className="w-40">
                      <Select
                        aria-label="Chuyển trạng thái"
                        value={p.status}
                        onChange={(val) =>
                          setStatus.mutate({
                            id: p.id,
                            status: val as (typeof COLUMNS)[number]["key"],
                          })
                        }
                        options={COLUMNS.map((c) => ({
                          value: c.key,
                          label: c.label,
                        }))}
                      />
                    </div>
                    <ConfirmButton
                      idle=""
                      confirm="Xoá?"
                      icon={<Trash2 className="h-4 w-4" />}
                      className="rounded-lg px-2 py-1.5 hover:bg-destructive-soft"
                      onConfirm={() => remove.mutate({ id: p.id })}
                    />
                  </div>
                </Card>
              ))}
            </StaggerList>
          )}
        </section>
      ))}
    </div>
  );
}
