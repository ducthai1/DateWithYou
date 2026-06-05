"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
          <ul className="space-y-2">
            {plans.filter((p) => p.status === col.key).map((p) => (
              <li key={p.id} className="border-border flex items-center justify-between rounded-xl border p-3">
                <span className="text-sm">{p.title}</span>
                <span className="flex gap-1 text-xs">
                  {COLUMNS.filter((c) => c.key !== p.status).map((c) => (
                    <button key={c.key} className="text-accent" onClick={() => setStatus.mutate({ id: p.id, status: c.key })}>
                      →{c.label.split(" ")[0]}
                    </button>
                  ))}
                  <button className="text-red-500" onClick={() => remove.mutate({ id: p.id })}>✕</button>
                </span>
              </li>
            ))}
            {plans.filter((p) => p.status === col.key).length === 0 && (
              <li className="text-muted-foreground text-xs">—</li>
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
