"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal, ModalHeader } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { MemoryForm } from "./memory-form";

function monthKey(d: Date): string {
  return new Date(d).toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
}

export function MemoryTimeline() {
  const [adding, setAdding] = useState(false);
  const list = trpc.memory.list.useQuery();
  const utils = trpc.useUtils();
  const remove = trpc.memory.remove.useMutation({
    onSuccess: () => utils.memory.list.invalidate(),
  });

  const memories = list.data ?? [];
  const groups = memories.reduce<Record<string, typeof memories>>((acc, m) => {
    const k = monthKey(m.date);
    (acc[k] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6 lg:max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dòng kỷ niệm</h1>
        <Button onClick={() => setAdding(true)}>+ Thêm</Button>
      </div>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
      >
        <ModalHeader title="Thêm kỷ niệm" onClose={() => setAdding(false)} />
        <MemoryForm
          onDone={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      </Modal>

      {list.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : memories.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Chưa có kỷ niệm nào. Lưu khoảnh khắc đầu tiên nhé 💞
        </p>
      ) : (
        Object.entries(groups).map(([month, items]) => (
          <section key={month} className="space-y-3">
            <h2 className="text-muted-foreground text-sm font-medium capitalize">{month}</h2>
            {items.map((m) => (
              <Card key={m.id} className="p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{m.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(m.date).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                  <ConfirmButton
                    className="text-xs hover:underline"
                    onConfirm={() => remove.mutate({ id: m.id })}
                  />
                </div>
                {m.caption && <p className="mt-1 text-sm">{m.caption}</p>}
                {m.photos.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {m.photos.map((p: { url: string; publicId: string }) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={p.publicId}
                        src={p.url}
                        alt={m.title}
                        loading="lazy"
                        className="aspect-square w-full rounded-lg object-cover"
                      />
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
