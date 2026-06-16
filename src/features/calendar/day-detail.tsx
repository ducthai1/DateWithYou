"use client";

import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Modal, ModalHeader, ModalContent } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useCelebrate } from "@/components/ui/celebrate";
import { Sparkles, MapPin, Heart } from "lucide-react";
import { BUCKETS, mergeTags, type BucketKey } from "@/lib/plan-meta";
import { MemoryForm } from "@/features/memories/memory-form";
import { BucketSection } from "./bucket-section";
import { PlanItemForm, type EditableItem } from "./plan-item-form";
import type { DayItem } from "./plan-item-card";

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
    });
    setFormOpen(true);
  }

  return (
    <>
      <Modal open onClose={onClose} className="max-w-xl">
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
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.thumbnailUrl} alt="" className="h-8 w-8 rounded-md object-cover" />
                        )}
                        <span className="text-foreground">{m.title} <span className="text-muted-foreground">({m.year})</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative">
                {items.length === 0 && (
                  <div className="absolute inset-0 z-0 flex items-center justify-center opacity-20 pointer-events-none select-none">
                    <EmptyState
                      icon="calendar-heart"
                      title="Ngày này còn trống"
                      subtitle="Thêm một việc để cùng lên kế hoạch nhé."
                      className="py-0"
                    />
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

              {detail.data && (detail.data.memories.length > 0 || detail.data.visited.length > 0) && (
                <div className="border-border space-y-2 border-t pt-3">
                  <p className="text-muted-foreground text-xs font-semibold">Đã lưu trong ngày</p>
                  {detail.data.memories.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 text-sm">
                      <Heart className="h-3.5 w-3.5 shrink-0 text-accent" />
                      <span className="font-medium">{m.title}</span>
                    </div>
                  ))}
                  {detail.data.visited.map((v) => (
                    <div key={v.id} className="text-muted-foreground flex items-center gap-1.5 text-sm">
                      <MapPin className="h-3.5 w-3.5" /> {v.name} <span className="text-xs">· {v.category}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </ModalContent>
      </Modal>

      {formOpen && (
        <Modal open onClose={() => setFormOpen(false)} className="max-w-md">
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
        <Modal open onClose={() => setMemoryFor(null)} className="max-w-md">
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
