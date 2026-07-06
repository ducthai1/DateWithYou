"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal, ModalHeader, ModalContent, ModalFooter } from "@/components/ui/modal";
import { PhotoView } from "react-photo-view";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmbedPlayer } from "@/components/ui/embed-player";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerList } from "@/components/ui/stagger-list";
import { type EmbedProvider } from "@/lib/embed";
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

import { useToast } from "@/components/ui/toast";

function monthKey(d: Date): string {
  return new Date(d).toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
}

export function MemoryTimeline() {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [warningEditId, setWarningEditId] = useState<string | null>(null);
  const list = trpc.memory.list.useQuery();
  const utils = trpc.useUtils();
  const remove = trpc.memory.remove.useMutation({
    onSuccess: () => { utils.memory.list.invalidate(); toast("Đã xoá kỷ niệm", "success"); },
    onError: (err) => toast(err.message, "error")
  });

  const all = list.data ?? [];
  type Memo = (typeof all)[number];
  const allTags = useMemo(
    () => [...new Set((list.data ?? []).flatMap((m) => m.tags ?? []))],
    [list.data],
  );
  // Memoised so the tag-filter and month grouping (a reduce over the whole feed)
  // don't re-run on every unrelated re-render — opening the detail modal, typing
  // in the add form, etc. Recompute only when the data or active filter changes.
  const memories: Memo[] = useMemo(() => {
    const data = list.data ?? [];
    return filter ? data.filter((m) => (m.tags ?? []).includes(filter)) : data;
  }, [list.data, filter]);
  const selectedMemo = selected ? all.find((m) => m.id === selected) ?? null : null;
  const groups = useMemo(
    () =>
      memories.reduce<Record<string, Memo[]>>((acc, m) => {
        (acc[monthKey(m.date)] ??= []).push(m);
        return acc;
      }, {}),
    [memories],
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 px-4 pt-6 pb-6 md:px-[30px]">
      <div className="sticky top-2 z-20 mb-6 flex flex-col gap-y-3 rounded-2xl bg-gradient-to-r from-accent-soft/90 to-accent-soft/30 px-4 py-4 shadow-sm backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:gap-y-0">
        <div>
          <h1 className="text-2xl font-semibold text-accent">Dòng kỷ niệm</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Lưu lại khoảnh khắc đã qua: ảnh, cảm xúc, nhạc/video kỷ niệm.
          </p>
        </div>
        <Button className="w-full sm:w-auto sm:shrink-0" onClick={() => setAdding(true)}>+ Thêm</Button>
      </div>

      {allTags.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs font-medium ml-0.5">Lọc theo nhãn:</p>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip label="Tất cả" active={!filter} onClick={() => setFilter(null)} />
            {allTags.map((t) => (
              <FilterChip key={t} label={t} active={filter === t} onClick={() => setFilter(t)} />
            ))}
          </div>
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
            <h2 className="text-foreground/80 text-sm font-medium capitalize sm:text-xs sm:text-muted-foreground">{month}</h2>
            <StaggerList className="gap-3 sm:columns-2 [&>*]:mb-3 [&>*]:break-inside-avoid">
              {items.map((m) => {
                const photoCount = m.photos.length;
                const embedCount = (m.embeds ?? []).length;
                return (
                  <Card
                    key={m.id}
                    interactive
                    className="cursor-pointer p-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                    onClick={() => setSelected(m.id)}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium leading-snug">{m.title}</p>
                        {/* Stop click bubbling so deleting doesn't open the detail. */}
                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                          <ConfirmButton idle="" className="text-xs" onConfirm={() => remove.mutate({ id: m.id })} />
                        </div>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {new Date(m.date).toLocaleDateString("vi-VN")}
                      </p>
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
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                      // Play inline on the card — stop clicks bubbling so playing
                      // a track/video doesn't also open the detail modal.
                      <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                        {(m.embeds as EmbedField[]).slice(0, 3).map((e: EmbedField) => (
                          <EmbedPlayer
                            key={e.url}
                            data={{
                              provider: e.provider as EmbedProvider,
                              url: e.url,
                              embedUrl: e.embedUrl,
                              thumbnailUrl: e.thumbnailUrl,
                              title: e.title,
                            }}
                          />
                        ))}
                        {embedCount > 3 && (
                          <p className="text-muted-foreground text-xs">+{embedCount - 3} link nữa — mở để xem</p>
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
                    <PhotoView key={p.publicId} src={p.url}>
                      <img src={p.url} alt={selectedMemo.title} loading="lazy" className="w-full cursor-zoom-in rounded-lg object-cover" />
                    </PhotoView>
                  ))}
                </div>
              )}
              {(selectedMemo.embeds ?? []).length > 0 && (
                <div className="space-y-2">
                  {(selectedMemo.embeds as EmbedField[]).map((e: EmbedField) => (
                    <EmbedPlayer
                      key={e.url}
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
            </ModalContent>
            <ModalFooter>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => setWarningEditId(selectedMemo.id)}
              >
                <Edit className="w-4 h-4 mr-2" /> Chỉnh sửa kỷ niệm
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>

      <Modal open={!!warningEditId} onClose={() => setWarningEditId(null)}>
        <ModalHeader
          title={
            <span className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
              <AlertTriangle className="h-5 w-5" />
              Sửa kỷ niệm này?
            </span>
          }
          onClose={() => setWarningEditId(null)}
        />
        <ModalContent>
          <p className="text-sm text-muted-foreground">
            Sửa kỷ niệm có thể thay đổi bố cục ảnh/nội dung đã lưu. Tiếp tục nhé?
          </p>
        </ModalContent>
        <ModalFooter className="flex-row justify-end gap-3">
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
        </ModalFooter>
      </Modal>

      <Modal open={!!editingMemoId} onClose={() => setEditingMemoId(null)}>
        <ModalHeader title="Chỉnh sửa kỷ niệm" onClose={() => setEditingMemoId(null)} />
        {editingMemoId && (() => {
          const m = all.find((m) => m.id === editingMemoId);
          if (!m) return null;
          return (
            <MemoryForm
              initialMemory={m}
              onDone={() => setEditingMemoId(null)}
              onCancel={() => setEditingMemoId(null)}
            />
          );
        })()}
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
        "inline-flex min-h-9 items-center rounded-full border px-3.5 py-1.5 text-xs transition-colors touch-manipulation active:scale-95",
        active ? "bg-accent border-accent text-accent-foreground" : "bg-card border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}
