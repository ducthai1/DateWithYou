"use client";

import { useMemo, useState } from "react";
import { ImagePlus } from "lucide-react";
import { PageShell, PageHeader } from "@/components/layout/page-shell";
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
import {
  ReactionBar,
  type InteractionInput,
  type InteractionState,
  type NoteRow,
  type ReactionRow,
} from "@/features/interactions/reaction-bar";
import { NoteThread } from "@/features/interactions/note-thread";
import { Edit, AlertTriangle } from "lucide-react";

type EmbedField = {
  provider: string;
  url: string;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  title: string | null;
};

import { useToast } from "@/components/ui/toast";

/** Ids per batched interaction request — matches the router's input cap. */
const INTERACTION_BATCH = 50;

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
  /*
   * Paged feed. The tag filter is part of the query key rather than applied
   * afterwards: filtering the pages already fetched would only search what
   * happens to be loaded, so a tag whose memories sit further down would come
   * back empty and look like they had been deleted.
   */
  const list = trpc.memory.list.useInfiniteQuery(
    { tag: filter || undefined },
    { getNextPageParam: (page) => page.nextCursor ?? undefined },
  );
  // Chips come from the whole space, not from the loaded pages, or a tag would
  // appear and vanish as you scroll.
  const tagsQuery = trpc.memory.tags.useQuery();
  const loaded = useMemo(
    () => (list.data?.pages ?? []).flatMap((p) => p.items),
    [list.data],
  );
  const utils = trpc.useUtils();
  const remove = trpc.memory.remove.useMutation({
    onSuccess: () => { utils.memory.list.invalidate(); toast("Đã xoá kỷ niệm", "success"); },
    onError: (err) => toast(err.message, "error")
  });

  // Member profiles power the reaction rings and note bylines. One query for
  // the whole page (react-query dedupes it app-wide). A failure only costs the
  // couple-chosen colours — those fall back to the accent token — so it never
  // blocks the feed.
  const membersQuery = trpc.space.members.useQuery();
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const selfId = members.find((m) => m.isSelf)?.id ?? null;

  const all = loaded;
  type Memo = (typeof all)[number];
  const allTags = tagsQuery.data ?? [];
  // Memoised so the tag-filter and month grouping (a reduce over the whole feed)
  // don't re-run on every unrelated re-render — opening the detail modal, typing
  // in the add form, etc. Recompute only when the data or active filter changes.
  // Already filtered by the server; the query key changes with `filter`.
  const memories: Memo[] = loaded;
  const selectedMemo = selected ? all.find((m) => m.id === selected) ?? null : null;
  const groups = useMemo(
    () =>
      memories.reduce<Record<string, Memo[]>>((acc, m) => {
        (acc[monthKey(m.date)] ??= []).push(m);
        return acc;
      }, {}),
    [memories],
  );

  // Reactions + notes for the whole feed, batched: one request per 50 ids,
  // never one per card. Batches are cut from the *unfiltered* list so flipping
  // the tag filter doesn't change the query key and force a refetch.
  const idBatches = useMemo(() => {
    const ids = loaded.map((m) => m.id);
    const out: string[][] = [];
    for (let i = 0; i < ids.length; i += INTERACTION_BATCH)
      out.push(ids.slice(i, i + INTERACTION_BATCH));
    return out;
  }, [loaded]);

  const interactionQueries = trpc.useQueries((t) =>
    idBatches.map((ids) =>
      t.interaction.forTargets({ targetType: "memory", targetIds: ids }),
    ),
  );

  // Per-batch state, not one global flag: a failed batch must not paint "chưa
  // tải được" onto cards whose own batch loaded fine.
  const interactions = useMemo(() => {
    const byTarget: Record<string, { reactions: ReactionRow[]; notes: NoteRow[] }> = {};
    const inputByTarget: Record<string, InteractionInput> = {};
    const stateByTarget: Record<string, InteractionState> = {};
    const batchByTarget: Record<string, number> = {};
    idBatches.forEach((ids, i) => {
      const input: InteractionInput = { targetType: "memory", targetIds: ids };
      const q = interactionQueries[i];
      const state: InteractionState = q?.isError
        ? "error"
        : q?.isPending
          ? "loading"
          : "ready";
      for (const id of ids) {
        inputByTarget[id] = input;
        stateByTarget[id] = state;
        batchByTarget[id] = i;
      }
      if (q?.data) Object.assign(byTarget, q.data);
    });
    return { byTarget, inputByTarget, stateByTarget, batchByTarget };
  }, [idBatches, interactionQueries]);

  const retryInteractions = (targetId: string) => {
    const i = interactions.batchByTarget[targetId];
    if (i !== undefined) void interactionQueries[i]?.refetch();
  };

  return (
    <PageShell className="space-y-4">
      <PageHeader
        title="Dòng kỷ niệm"
        subtitle="Lưu lại khoảnh khắc đã qua: ảnh, cảm xúc, nhạc/video kỷ niệm."
        art="memoriesScrapbook"
        actions={
          <Button className="w-full sm:w-auto sm:shrink-0" onClick={() => setAdding(true)}>
            + Thêm
          </Button>
        }
      />

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

      <Modal size="xl" open={adding} onClose={() => setAdding(false)}>
        <ModalHeader
          title="Thêm kỷ niệm"
          description="Ảnh, cảm xúc, nhạc hoặc video của một hôm đáng nhớ."
          icon={<ImagePlus className="h-[18px] w-[18px]" />}
          onClose={() => setAdding(false)}
        />
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
            // Header above already carries memoriesScrapbook; the same
            // picture twice on one screen reads as a rendering bug.
            art="emptyCanvas"
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
                const entry = interactions.byTarget[m.id];
                const interactionInput: InteractionInput =
                  interactions.inputByTarget[m.id] ?? {
                    targetType: "memory",
                    targetIds: [m.id],
                  };
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
                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}>
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
                      <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}>
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
                    {/* Reciprocity strip — the other partner's way to answer an
                        upload. Clicks are contained so reacting or writing a
                        note never also opens the detail modal. */}
                    <div
                      className="border-border mt-3 space-y-1 border-t pt-2"
                      onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                    >
                      <ReactionBar
                        targetType="memory"
                        targetId={m.id}
                        queryInput={interactionInput}
                        reactions={entry?.reactions ?? []}
                        members={members}
                        selfId={selfId}
                        state={interactions.stateByTarget[m.id] ?? "ready"}
                        onRetry={() => retryInteractions(m.id)}
                      />
                      <NoteThread
                        targetType="memory"
                        targetId={m.id}
                        queryInput={interactionInput}
                        notes={entry?.notes ?? []}
                        members={members}
                        selfId={selfId}
                        state={interactions.stateByTarget[m.id] ?? "ready"}
                        onRetry={() => retryInteractions(m.id)}
                      />
                    </div>
                  </Card>
                );
              })}
            </StaggerList>
          </section>
        ))
      )}

      {/* A button rather than scroll-triggered loading: this feed is browsed by
          scrolling back through months, and auto-loading on scroll makes it
          impossible to reach anything below the feed. */}
      {list.hasNextPage ? (
        <div className="flex justify-center pt-2 pb-6">
          <Button
            variant="outline"
            onClick={() => list.fetchNextPage()}
            disabled={list.isFetchingNextPage}
          >
            {list.isFetchingNextPage ? "Đang tải…" : "Xem thêm kỷ niệm cũ hơn"}
          </Button>
        </div>
      ) : null}

      <Modal size="xl" open={!!selectedMemo} onClose={() => setSelected(null)}>
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

      <Modal size="xl" open={!!warningEditId} onClose={() => setWarningEditId(null)}>
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

      <Modal size="xl" open={!!editingMemoId} onClose={() => setEditingMemoId(null)}>
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
    </PageShell>
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
