"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal, ModalHeader, ModalContent } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmbedPlayer } from "@/components/ui/embed-player";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerList } from "@/components/ui/stagger-list";
import { type EmbedProvider, PROVIDER_LABEL } from "@/lib/embed";
import { cn } from "@/lib/utils";
import { MemoryForm } from "./memory-form";
import { Edit, AlertTriangle } from "lucide-react";

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
  const [selected, setSelected] = useState<string | null>(null);
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [warningEditId, setWarningEditId] = useState<string | null>(null);
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
  const selectedMemo = selected ? all.find((m) => m.id === selected) ?? null : null;
  const groups = memories.reduce<Record<string, Memo[]>>((acc, m) => {
    (acc[monthKey(m.date)] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-6 md:px-[30px]">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 font-serif">Dòng kỷ niệm</h1>
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
          <Skeleton variant="card" className="h-24" />
          <Skeleton variant="card" className="h-24" />
        </div>
      ) : memories.length === 0 ? (
        filter ? (
          <EmptyState
            icon="sparkles"
            title="Không tìm thấy kỷ niệm"
            subtitle="Không có kỷ niệm nào với nhãn này."
            action={{ label: "Xem tất cả", onClick: () => setFilter(null) }}
          />
        ) : (
          <EmptyState
            icon="sparkles"
            title="Chưa có kỷ niệm nào"
            subtitle="Lưu khoảnh khắc đầu tiên — hình ảnh, cảm xúc, khoảnh khắc nhỏ."
            action={{ label: "+ Lưu kỷ niệm", onClick: () => setAdding(true) }}
          />
        )
      ) : (
        Object.entries(groups).map(([month, items]: [string, Memo[]]) => (
          <section key={month} className="space-y-3">
            <h2 className="text-muted-foreground text-sm font-medium capitalize">{month}</h2>
            <StaggerList className="gap-3 sm:columns-2 [&>*]:mb-3 [&>*]:break-inside-avoid">
              {items.map((m) => {
                const photoCount = m.photos.length;
                const embedCount = (m.embeds ?? []).length;
                return (
                  <Card
                    key={m.id}
                    interactive
                    className="cursor-pointer p-3"
                    onClick={() => setSelected(m.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{m.title}</p>
                        <p className="text-muted-foreground text-xs">
                          {new Date(m.date).toLocaleDateString("vi-VN")}
                        </p>
                      </div>
                      {/* Stop click bubbling so deleting doesn't open the detail. */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <ConfirmButton idle="" className="text-xs" onConfirm={() => remove.mutate({ id: m.id })} />
                      </div>
                    </div>
                    {m.caption && <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{m.caption}</p>}
                    {(m.tags ?? []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(m.tags as string[]).map((t: string) => (
                          <span key={t} className="bg-accent-soft text-accent rounded-full px-2 py-0.5 text-[10px] font-medium">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {photoCount > 0 && (
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {m.photos.slice(0, 3).map((p: { url: string; publicId: string }) => (
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
                    {embedCount > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {(m.embeds as EmbedField[]).slice(0, 2).map((e: EmbedField, i: number) => (
                          <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/50 p-1.5">
                            {e.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={e.thumbnailUrl}
                                alt={e.title ?? e.provider}
                                loading="lazy"
                                className="h-10 w-16 shrink-0 rounded object-cover"
                              />
                            ) : (
                              <span className="bg-accent-soft text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded text-[10px] font-bold uppercase">
                                {e.provider === "tiktok" ? "TT" : e.provider === "spotify" ? "♫" : "▶"}
                              </span>
                            )}
                            <p className="text-muted-foreground min-w-0 truncate text-[11px]">
                              {e.title || PROVIDER_LABEL[e.provider as EmbedProvider]}
                            </p>
                          </div>
                        ))}
                        {embedCount > 2 && (
                          <p className="text-muted-foreground text-xs">+{embedCount - 2} link</p>
                        )}
                      </div>
                    )}
                    {photoCount > 3 && (
                      <p className="text-muted-foreground mt-2 text-xs">
                        +{photoCount - 3} ảnh
                      </p>
                    )}
                  </Card>
                );
              })}
            </StaggerList>
          </section>
        ))
      )}

      <Modal open={!!selectedMemo} onClose={() => setSelected(null)}>
        {selectedMemo && (
          <>
            <ModalHeader title={selectedMemo.title} onClose={() => setSelected(null)} />
            <ModalContent className="space-y-3">
              <p className="text-muted-foreground text-xs">
                {new Date(selectedMemo.date).toLocaleDateString("vi-VN", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                })}
              </p>
              {selectedMemo.caption && <p className="text-sm">{selectedMemo.caption}</p>}
              {(selectedMemo.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(selectedMemo.tags as string[]).map((t) => (
                    <span key={t} className="bg-accent-soft text-accent rounded-full px-2 py-0.5 text-[10px] font-medium">{t}</span>
                  ))}
                </div>
              )}
              {selectedMemo.photos.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {selectedMemo.photos.map((p: { url: string; publicId: string }) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={p.publicId} src={p.url} alt={selectedMemo.title} loading="lazy" className="w-full rounded-lg object-cover" />
                  ))}
                </div>
              )}
              {(selectedMemo.embeds ?? []).length > 0 && (
                <div className="space-y-2">
                  {(selectedMemo.embeds as EmbedField[]).map((e: EmbedField, i: number) => (
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
              <Button 
                variant="outline" 
                className="w-full mt-2" 
                onClick={() => setWarningEditId(selectedMemo.id)}
              >
                <Edit className="w-4 h-4 mr-2" /> Chỉnh sửa kỷ niệm
              </Button>
            </ModalContent>
          </>
        )}
      </Modal>

      <Modal open={!!warningEditId} onClose={() => setWarningEditId(null)}>
        <ModalHeader
          title={
            <span className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
              <AlertTriangle className="h-5 w-5" />
              Cảnh báo sửa đổi
            </span>
          }
          onClose={() => setWarningEditId(null)}
        />
        <ModalContent>
          <p className="text-sm text-muted-foreground">
            Việc chỉnh sửa có thể vô tình làm thay đổi thiết kế hoặc làm hỏng kỷ niệm hiện tại. Bạn có chắc chắn muốn tiếp tục chỉnh sửa không?
          </p>
        </ModalContent>
        <div className="p-4 pt-0 flex gap-3 justify-end border-t border-border/50 mt-4">
          <Button variant="ghost" onClick={() => setWarningEditId(null)}>Huỷ</Button>
          <Button
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => {
              setEditingMemoId(warningEditId);
              setWarningEditId(null);
              setSelected(null);
            }}
          >
            Vẫn tiếp tục sửa
          </Button>
        </div>
      </Modal>

      <Modal open={!!editingMemoId} onClose={() => setEditingMemoId(null)}>
        <ModalHeader title="Chỉnh sửa kỷ niệm" onClose={() => setEditingMemoId(null)} />
        {editingMemoId && (
          <MemoryForm
            initialMemory={all.find((m) => m.id === editingMemoId) as any}
            onDone={() => setEditingMemoId(null)}
            onCancel={() => setEditingMemoId(null)}
          />
        )}
      </Modal>
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
