"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

import type { LatLng } from "@/lib/maps";

export type LocationFormValues = {
  id?: string;
  name: string;
  district: string;
  category: string;
  geo: LatLng | null;
  googleMapsUrl: string;
  socialUrl: string;
  mustTry: string;
  rating: number | null;
  openTime: string;
  closeTime: string;
  note: string;
};

/**
 * Maps a tRPC mutation error to a human reason. The previous code always blamed
 * the link, which hid the real causes (no couple space, validation, network).
 */
function saveErrorMessage(error: { message?: string } | null | undefined): string {
  const msg = error?.message ?? "";
  if (msg.includes("NO_SPACE") || msg.includes("FORBIDDEN"))
    return "Bạn chưa có không gian. Vào /onboarding để tạo trước nhé.";
  if (msg.toLowerCase().includes("url") || msg.includes("https"))
    return "Link không hợp lệ — phải bắt đầu bằng https://";
  return `Không lưu được: ${msg}`;
}

const empty: LocationFormValues = {
  name: "",
  district: "",
  category: "",
  geo: null,
  googleMapsUrl: "",
  socialUrl: "",
  mustTry: "",
  rating: null,
  openTime: "",
  closeTime: "",
  note: "",
};

export function LocationForm({
  initial,
  categories,
  districts,
  onDone,
  onCancel,
}: {
  initial?: Partial<LocationFormValues>;
  categories: string[];
  districts: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<LocationFormValues>({
    ...empty,
    district: initial?.district || districts[0] || "",
    category: initial?.category || categories[0] || "",
    ...initial,
  });
  const utils = trpc.useUtils();
  const set = <K extends keyof LocationFormValues>(
    k: K,
    val: LocationFormValues[K],
  ) => setV((p) => ({ ...p, [k]: val }));

  const onSuccess = () => {
    utils.location.list.invalidate();
    onDone();
  };
  const create = trpc.location.create.useMutation({ onSuccess });
  const update = trpc.location.update.useMutation({ onSuccess });
  const pending = create.isPending || update.isPending;

  function submit() {
    const payload = {
      name: v.name.trim(),
      district: v.district,
      category: v.category,
      geo: (initial && v.googleMapsUrl !== initial.googleMapsUrl && v.geo === initial.geo) ? undefined : (v.geo ?? undefined),
      googleMapsUrl: v.googleMapsUrl.trim() || undefined,
      socialUrl: v.socialUrl.trim() || undefined,
      mustTry: v.mustTry.trim() || undefined,
      rating: v.rating ?? undefined,
      openTime: v.openTime || undefined,
      closeTime: v.closeTime || undefined,
      note: v.note.trim() || undefined,
    };
    if (v.id) update.mutate({ id: v.id, ...payload });
    else create.mutate(payload);
  }

  return (
    <div className="border-border bg-card space-y-3 rounded-2xl border p-5 shadow-sm">
      <Input
        placeholder="Tên quán"
        value={v.name}
        onChange={(e) => set("name", e.target.value)}
      />
      <div className="flex gap-2">
        <Select
          aria-label="Quận"
          value={v.district}
          onChange={(val) => set("district", val)}
          options={districts.map((d) => ({ value: d, label: d }))}
        />
        <Select
          aria-label="Danh mục"
          value={v.category}
          onChange={(val) => set("category", val)}
          options={categories.map((c) => ({ value: c, label: c }))}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        {v.geo
          ? `📍 ${v.geo.lat.toFixed(4)}, ${v.geo.lng.toFixed(4)} (chạm bản đồ để đổi)`
          : "Chạm lên bản đồ để chọn vị trí"}
      </p>
      <Input
        placeholder="Link Google Maps (https://)"
        value={v.googleMapsUrl}
        onChange={(e) => set("googleMapsUrl", e.target.value)}
      />
      <Input
        placeholder="Link TikTok/Instagram (https://)"
        value={v.socialUrl}
        onChange={(e) => set("socialUrl", e.target.value)}
      />
      <Input
        placeholder="Món must-try"
        value={v.mustTry}
        onChange={(e) => set("mustTry", e.target.value)}
      />
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground ml-1">Giờ mở cửa</label>
          <Input
            type="time"
            value={v.openTime}
            onChange={(e) => set("openTime", e.target.value)}
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground ml-1">Giờ đóng cửa</label>
          <Input
            type="time"
            value={v.closeTime}
            onChange={(e) => set("closeTime", e.target.value)}
          />
        </div>
      </div>
      <Select
        aria-label="Đánh giá sao"
        value={v.rating ? String(v.rating) : ""}
        onChange={(val) => set("rating", val ? Number(val) : null)}
        options={[
          { value: "", label: "Đánh giá (sao)" },
          ...[1, 2, 3, 4, 5].map((n) => ({
            value: String(n),
            label: "★".repeat(n),
          })),
        ]}
      />
      {(create.error || update.error) && (
        <p className="text-destructive text-sm">
          {saveErrorMessage(create.error ?? update.error)}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={submit} disabled={!v.name.trim() || pending} className="flex-1">
          {pending ? "Đang lưu…" : v.id ? "Cập nhật" : "Thêm địa điểm"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Huỷ
        </Button>
      </div>
    </div>
  );
}
