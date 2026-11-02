"use client";

import { useState } from "react";
import { readableFormError } from "@/lib/form-error";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { ModalContent, ModalFooter } from "@/components/ui/modal";
import { TimePicker } from "@/components/ui/time-picker";
import { BUCKETS, DAY_ACTIVITIES, bucketForTime, type BucketKey } from "@/lib/plan-meta";
import { Chip } from "@/components/ui/chip";
import { MoneyInput } from "@/components/ui/money-input";
import { Plus } from "lucide-react";

/** Round amounts for one outing, not a trip — a coffee to a nice dinner for two. */
const COST_PRESETS = [50_000, 100_000, 200_000, 500_000];
import { TagPicker } from "./tag-picker";
import { useToast } from "@/components/ui/toast";

export type EditableItem = {
  id: string;
  title: string;
  note: string | null;
  bucket: BucketKey;
  time: string | null;
  tags: string[];
  assigneeId: string | null;
  locationId: string | null;
  tripId: string | null;
  cost: number;
};

export function PlanItemForm({
  date,
  item,
  defaultBucket,
  tripId,
  onDone,
  onCancel,
}: {
  date: string;
  item?: EditableItem;
  defaultBucket?: BucketKey;
  tripId?: string; // Optional trip scope
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [pickedBucket, setPickedBucket] = useState<BucketKey>(
    item?.bucket ?? defaultBucket ?? "morning",
  );
  const [time, setTime] = useState(item?.time ?? "");
  // A time settles the bucket: 19:00 is "Tối", never "Sáng". The server applies
  // the same rule, so letting the two be edited apart would only show a value
  // that is about to be overwritten. Clearing the time hands the choice back.
  const bucket = time ? bucketForTime(time) : pickedBucket;
  const [tags, setTags] = useState<string[]>(item?.tags ?? []);
  const [assigneeId, setAssigneeId] = useState(item?.assigneeId ?? "");
  const [locationId, setLocationId] = useState(item?.locationId ?? "");
  const [cost, setCost] = useState<number | null>(item?.cost ? item.cost : null);
  const [noteOpen, setNoteOpen] = useState(!!item?.note);

  const toast = useToast();
  const members = trpc.space.members.useQuery();
  const locations = trpc.location.list.useQuery(undefined);
  const utils = trpc.useUtils();
  const invalidate = () => {
    utils.calendar.dayDetail.invalidate({ date });
    utils.calendar.monthSummary.invalidate();
    if (tripId) utils.trip.get.invalidate({ id: tripId });
    if (tripId) utils.planItem.listByTrip.invalidate({ tripId });
  };
  const create = trpc.planItem.create.useMutation({
    onSuccess: () => { invalidate(); onDone(); toast("Đã lưu kế hoạch", "success"); },
    onError: (err) => toast(readableFormError(err.message), "error"),
  });
  const update = trpc.planItem.update.useMutation({
    onSuccess: () => { invalidate(); onDone(); toast("Đã cập nhật kế hoạch", "success"); },
    onError: (err) => toast(readableFormError(err.message), "error"),
  });
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
      tripId: tripId || undefined,
      cost: cost ?? 0,
    };
    if (item) update.mutate({ id: item.id, ...payload });
    else create.mutate(payload);
  }

  return (
    <>
      <ModalContent className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground ml-1 block">Tiêu đề công việc</label>
          <Input aria-label="Tiêu đề công việc" placeholder="Làm gì nào?" value={title} onChange={(e) => setTitle(e.target.value)} />
          {!item && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Việc hay làm">
              {DAY_ACTIVITIES.map((a) => (
                <Chip
                  key={a.title}
                  label={a.title}
                  selected={title === a.title}
                  onClick={() => {
                    setTitle(a.title);
                    if (a.bucket && !time) setPickedBucket(a.bucket);
                  }}
                  className="px-3"
                />
              ))}
            </div>
          )}
        </div>
        {noteOpen ? (
          <div>
            <label className="text-xs font-medium text-muted-foreground ml-1 mb-2 block">Ghi chú chi tiết</label>
            <Textarea placeholder="Ghi chú (tuỳ chọn)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="text-muted-foreground hover:text-accent-ink -mt-2 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-1 text-sm font-medium"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Thêm ghi chú
          </button>
        )}

        {/* Bucket + time: stack on mobile so each control gets full width;
            side-by-side on sm+ where there is room. */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-2.5">
            <label className="text-xs font-medium text-muted-foreground ml-1">Buổi trong ngày</label>
            <Select
              aria-label="Buổi"
              value={bucket}
              disabled={Boolean(time)}
              onChange={(v) => setPickedBucket(v as BucketKey)}
              options={BUCKETS.map((b) => ({ value: b.key, label: b.label }))}
            />
            {time && (
              <p className="text-muted-foreground ml-1 text-xs">
                Theo giờ {time}. Xoá giờ để tự chọn buổi.
              </p>
            )}
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
            <p className="text-muted-foreground text-xs ml-1">Ai thực hiện việc này (Cả hai = việc chung).</p>
          </div>
          <div className="space-y-2.5">
            <label className="text-xs font-medium text-muted-foreground ml-1">Gắn địa điểm</label>
            <Select
              aria-label="Địa điểm"
              value={locationId}
              onChange={(id) => {
                setLocationId(id);
                // An unnamed item at a place is a visit to that place.
                const place = (locations.data ?? []).find((l) => l.id === id);
                if (place && !title.trim()) setTitle(place.name);
              }}
              placeholder="Không gắn địa điểm"
              options={[
                { value: "", label: "Không gắn địa điểm" },
                ...(locations.data ?? []).map((l) => ({ value: l.id, label: l.name })),
              ]}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground ml-1 mb-2 block">Chi phí dự kiến</label>
          <MoneyInput value={cost} onChange={setCost} presets={COST_PRESETS} ariaLabel="Chi phí dự kiến" placeholder="Không tốn gì" />
        </div>
      </ModalContent>

      <ModalFooter>
        <Button variant="secondary" className="flex-1" onClick={onCancel}>Huỷ</Button>
        <Button className="flex-1" disabled={!title.trim() || pending} onClick={submit}>
          {pending ? "Đang lưu…" : item ? "Lưu" : "Thêm việc"}
        </Button>
      </ModalFooter>
    </>
  );
}
