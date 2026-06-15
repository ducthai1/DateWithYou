"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal, ModalHeader } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmbedPlayer } from "@/components/ui/embed-player";
import { type EmbedProvider } from "@/lib/embed";
import { cn } from "@/lib/utils";
import { MemoryForm } from "./memory-form";

type EmbedField = {
  provider: string;
  url: string;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  title: string | null;
};

function monthKey(d: Date): string {
  return new Date(d).toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
}

export function MemoryTimeline() {
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const list = trpc.memory.list.useQuery();
  const utils = trpc.useUtils();
  const remove = trpc.memory.remove.useMutation({
    onSuccess: () => utils.memory.list.invalidate(),
  });

  const all = list.data ?? [];
  type Memo = (typeof all)[number];
  const allTags = useMemo(
    () => [...new Set((list.data ?? []).flatMap((m) => m.tags ?? []))],
    [list.data],
  );
  const memories: Memo[] = filter ? all.filter((m) => (m.tags ?? []).includes(filter)) : all;
  const groups = memories.reduce<Record<string, Memo[]>>((acc, m) => {
    (acc[monthKey(m.date)] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6 lg:max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dòng kỷ niệm</h1>
        <Button onClick={() => setAdding(true)}>+ Thêm</Button>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip label="Tất cả" active={!filter} onClick={() => setFilter(null)} />
          {allTags.map((t) => (
            <FilterChip key={t} label={t} active={filter === t} onClick={() => setFilter(t)} />
          ))}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)}>
        <ModalHeader title="Thêm kỷ niệm" onClose={() => setAdding(false)} />
        <MemoryForm onDone={() => setAdding(false)} onCancel={() => setAdding(false)} />
      </Modal>

      {list.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : memories.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {filter ? "Không có kỷ niệm nào với nhãn này." : "Chưa có kỷ niệm nào. Lưu khoảnh khắc đầu tiên nhé 💞"}
        </p>
      ) : (
        Object.entries(groups).map(([month, items]: [string, Memo[]]) => (
          <section key={month} className="space-y-3">
            <h2 className="text-muted-foreground text-sm font-medium capitalize">{month}</h2>
            <div className="gap-3 sm:columns-2 [&>*]:mb-3 [&>*]:break-inside-avoid">
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
                      idle=""
                      className="text-xs"
                      onConfirm={() => remove.mutate({ id: m.id })}
                    />
                  </div>
                  {m.caption && <p className="mt-1 text-sm">{m.caption}</p>}
                  {(m.tags ?? []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(m.tags as string[]).map((t: string) => (
                        <span key={t} className="bg-accent-soft text-accent rounded-full px-2 py-0.5 text-[10px] font-medium">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
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
                  {(m.embeds ?? []).length > 0 && (
                    <div className="mt-2 space-y-2">
                      {(m.embeds as EmbedField[]).map((e: EmbedField, i: number) => (
                        <EmbedPlayer
                          key={i}
                          data={{
                            provider: e.provider as EmbedProvider,
                            url: e.url,
                            embedUrl: e.embedUrl,
                            thumbnailUrl: e.thumbnailUrl,
                            title: e.title,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active ? "bg-accent border-accent text-accent-foreground" : "bg-card border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}
