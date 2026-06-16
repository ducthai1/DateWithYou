"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { ModalContent, ModalFooter } from "@/components/ui/modal";
import { TimePicker } from "@/components/ui/time-picker";
import { BUCKETS, type BucketKey } from "@/lib/plan-meta";
import { TagPicker } from "./tag-picker";

export type EditableItem = {
  id: string;
  title: string;
  note: string | null;
  bucket: BucketKey;
  time: string | null;
  tags: string[];
  assigneeId: string | null;
  locationId: string | null;
};

export function PlanItemForm({
  date,
  item,
  defaultBucket,
  onDone,
  onCancel,
}: {
  date: string;
  item?: EditableItem;
  defaultBucket?: BucketKey;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [bucket, setBucket] = useState<BucketKey>(item?.bucket ?? defaultBucket ?? "morning");
  const [time, setTime] = useState(item?.time ?? "");
  const [tags, setTags] = useState<string[]>(item?.tags ?? []);
  const [assigneeId, setAssigneeId] = useState(item?.assigneeId ?? "");
  const [locationId, setLocationId] = useState(item?.locationId ?? "");

  const members = trpc.space.members.useQuery();
  const locations = trpc.location.list.useQuery(undefined);
  const utils = trpc.useUtils();
  const invalidate = () => {
    utils.calendar.dayDetail.invalidate({ date });
    utils.calendar.monthSummary.invalidate();
  };
  const create = trpc.planItem.create.useMutation({ onSuccess: () => { invalidate(); onDone(); } });
  const update = trpc.planItem.update.useMutation({ onSuccess: () => { invalidate(); onDone(); } });
  const pending = create.isPending || update.isPending;

  function submit() {
    const payload = {
      title: title.trim(),
      note: note.trim() || undefined,
      date,
      bucket,
      time: time || undefined,
      tags,
      assigneeId: assigneeId || undefined,
      locationId: locationId || undefined,
    };
    if (item) update.mutate({ id: item.id, ...payload });
    else create.mutate(payload);
  }

  return (
    <>
      <ModalContent className="space-y-5">
        <div>
          <label className="text-xs font-medium text-muted-foreground ml-1 mb-2 block">Tiêu đề công việc</label>
          <Input placeholder="Làm gì nào?" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground ml-1 mb-2 block">Ghi chú chi tiết</label>
          <Textarea placeholder="Ghi chú (tuỳ chọn)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2.5">
            <label className="text-xs font-medium text-muted-foreground ml-1">Buổi trong ngày</label>
            <Select
              aria-label="Buổi"
              value={bucket}
              onChange={(v) => setBucket(v as BucketKey)}
              options={BUCKETS.map((b) => ({ value: b.key, label: b.label }))}
            />
          </div>
          <div className="space-y-2.5">
            <label className="text-xs font-medium text-muted-foreground ml-1">Giờ (tuỳ chọn)</label>
            <TimePicker value={time} onChange={setTime} />
          </div>
        </div>

        <div>
          <p className="text-muted-foreground mb-1.5 text-xs font-medium">Nhãn</p>
          <TagPicker value={tags} onChange={setTags} />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-2.5">
            <label className="text-xs font-medium text-muted-foreground ml-1">Người phụ trách</label>
            <Select
              aria-label="Ai phụ trách"
              value={assigneeId}
              onChange={setAssigneeId}
              options={[
                { value: "", label: "Cả hai" },
                ...(members.data ?? []).map((m) => ({ value: m.id, label: m.name })),
              ]}
            />
          </div>
          <div className="space-y-2.5">
            <label className="text-xs font-medium text-muted-foreground ml-1">Gắn địa điểm</label>
            <Select
              aria-label="Địa điểm"
              value={locationId}
              onChange={setLocationId}
              placeholder="Không gắn địa điểm"
              options={[
                { value: "", label: "Không gắn địa điểm" },
                ...(locations.data ?? []).map((l) => ({ value: l.id, label: l.name })),
              ]}
            />
          </div>
        </div>
      </ModalContent>

      <ModalFooter>
        <Button variant="ghost" onClick={onCancel}>Huỷ</Button>
        <Button disabled={!title.trim() || pending} onClick={submit}>
          {pending ? "Đang lưu…" : item ? "Lưu" : "Thêm việc"}
        </Button>
      </ModalFooter>
    </>
  );
}
