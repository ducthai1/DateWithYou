"use client";

import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Modal, ModalHeader, ModalContent } from "@/components/ui/modal";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useIsMobile } from "@/hooks/use-media-query";
import { Skeleton } from "@/components/ui/skeleton";

import { useCelebrate } from "@/components/ui/celebrate";
import { Sparkles, CalendarHeart } from "lucide-react";
import { BUCKETS, mergeTags, type BucketKey } from "@/lib/plan-meta";
import { MemoryForm } from "@/features/memories/memory-form";
import { BucketSection } from "./bucket-section";
import { PlanItemForm, type EditableItem } from "./plan-item-form";
import type { DayItem } from "./plan-item-card";
import { PhotoView } from "react-photo-view";

function formatDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function DayDetail({ date, onClose }: { date: string; onClose: () => void }) {
  const detail = trpc.calendar.dayDetail.useQuery({ date });
  const members = trpc.space.members.useQuery();
  const tags = trpc.space.tags.useQuery();
  const locations = trpc.location.list.useQuery(undefined);
  const celebrate = useCelebrate();
  // Anchor the celebration burst to the modal body so it stays in-context.
  const modalRef = useRef<HTMLDivElement>(null);
  // Mobile uses a bottom sheet; desktop keeps the centered modal. The shell
  // only mounts after a day is tapped (post-hydration), so reading the
  // viewport here is safe from SSR mismatch.
  const isMobile = useIsMobile();
  const Shell = isMobile ? BottomSheet : Modal;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EditableItem | undefined>();
  const [addBucket, setAddBucket] = useState<BucketKey>("morning");
  const [memoryFor, setMemoryFor] = useState<DayItem | null>(null);

  const palette = tags.data ?? mergeTags(undefined);
  const locationNames: Record<string, string> = Object.fromEntries(
    (locations.data ?? []).map((l) => [l.id, l.name]),
  );

  const items = (detail.data?.items ?? []) as DayItem[] & { bucket: BucketKey }[];
  const byBucket = (b: BucketKey) =>
    (detail.data?.items ?? []).filter((i) => i.bucket === b) as DayItem[];

  function openAdd(bucket: BucketKey) {
    setEditing(undefined);
    setAddBucket(bucket);
    setFormOpen(true);
  }
  function openEdit(it: DayItem & { bucket?: BucketKey }) {
    const full = (detail.data?.items ?? []).find((x) => x.id === it.id);
    if (!full) return;
    setEditing({
      id: full.id,
      title: full.title,
      note: full.note,
      bucket: full.bucket,
      time: full.time,
      tags: full.tags,
      assigneeId: full.assigneeId,
      locationId: full.locationId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tripId: (full as any).tripId || null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cost: (full as any).cost || 0,
    });
    setFormOpen(true);
  }

  return (
    <>
      <Shell open onClose={onClose} className={isMobile ? undefined : "max-w-xl"}>
        <ModalHeader title={<span className="capitalize">{formatDay(date)}</span>} onClose={onClose} />
        <ModalContent className="space-y-5">
          {detail.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              {detail.data && detail.data.onThisDay.length > 0 && (
                <div className="bg-accent-soft/60 rounded-xl p-3">
                  <p className="text-accent mb-1.5 flex items-center gap-1 text-xs font-semibold">
                    <Sparkles className="h-3.5 w-3.5" /> Ngày này năm xưa
                  </p>
                  <div className="flex gap-2 overflow-x-auto">
                    {detail.data.onThisDay.map((m) => (
                      <div key={m.id} className="flex shrink-0 items-center gap-1.5 text-xs">
                        {m.thumbnailUrl && (
                          <PhotoView src={m.thumbnailUrl}>
                            <img src={m.thumbnailUrl} alt="" className="h-8 w-8 cursor-zoom-in rounded-md object-cover" />
                          </PhotoView>
                        )}
                        <span className="text-foreground">{m.title} <span className="text-muted-foreground">({m.year})</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative">
                {items.length === 0 && (
                  <div className="absolute inset-0 z-0 flex flex-col items-center justify-center opacity-20 pointer-events-none select-none text-muted-foreground mix-blend-multiply dark:mix-blend-screen">
                    <CalendarHeart className="h-20 w-20 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                )}
                <div className="relative z-10 space-y-6">
                  {BUCKETS.map((b) => (
                    <BucketSection
                      key={b.key}
                      label={b.label}
                      icon={b.icon}
                      items={byBucket(b.key)}
                      date={date}
                      members={members.data ?? []}
                      palette={palette}
                      locationNames={locationNames}
                      onAdd={() => openAdd(b.key)}
                      onEdit={openEdit}
                      onSaveAsMemory={setMemoryFor}
                    />
                  ))}
                </div>
              </div>


            </>
          )}
        </ModalContent>
      </Shell>

      {formOpen && (
        <Modal open onClose={() => setFormOpen(false)} className="max-w-lg">
          <ModalHeader title={editing ? "Sửa việc" : "Thêm việc"} onClose={() => setFormOpen(false)} />
          <PlanItemForm
            date={date}
            item={editing}
            defaultBucket={addBucket}
            onDone={() => setFormOpen(false)}
            onCancel={() => setFormOpen(false)}
          />
        </Modal>
      )}

      {memoryFor && (
        <Modal open onClose={() => setMemoryFor(null)} className="max-w-lg">
          <ModalHeader title="Lưu thành kỷ niệm" onClose={() => setMemoryFor(null)} />
          <div ref={modalRef} className="absolute inset-0 pointer-events-none" />
          <MemoryForm
            initialTitle={memoryFor.title}
            initialDate={date}
            initialLocationId={memoryFor.locationId ?? undefined}
            onDone={() => {
              celebrate(modalRef.current);
              setMemoryFor(null);
            }}
            onCancel={() => setMemoryFor(null)}
          />
        </Modal>
      )}
    </>
  );
}
