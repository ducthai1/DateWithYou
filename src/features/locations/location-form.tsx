"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  DISTRICTS,
  CATEGORIES,
  type District,
  type Category,
} from "@/lib/districts-categories";
import type { LatLng } from "@/lib/maps";

export type LocationFormValues = {
  id?: string;
  name: string;
  district: District;
  category: Category;
  geo: LatLng | null;
  googleMapsUrl: string;
  socialUrl: string;
  mustTry: string;
  rating: number | null;
  note: string;
};

const empty: LocationFormValues = {
  name: "",
  district: "Quận 1",
  category: "Cà phê",
  geo: null,
  googleMapsUrl: "",
  socialUrl: "",
  mustTry: "",
  rating: null,
  note: "",
};

export function LocationForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: Partial<LocationFormValues>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<LocationFormValues>({ ...empty, ...initial });
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
      geo: v.geo ?? undefined,
      googleMapsUrl: v.googleMapsUrl.trim() || undefined,
      socialUrl: v.socialUrl.trim() || undefined,
      mustTry: v.mustTry.trim() || undefined,
      rating: v.rating ?? undefined,
      note: v.note.trim() || undefined,
    };
    if (v.id) update.mutate({ id: v.id, ...payload });
    else create.mutate(payload);
  }

  return (
    <div className="border-border space-y-3 rounded-xl border p-4">
      <Input
        placeholder="Tên quán"
        value={v.name}
        onChange={(e) => set("name", e.target.value)}
      />
      <div className="flex gap-2">
        <Select
          value={v.district}
          onChange={(e) => set("district", e.target.value as District)}
        >
          {DISTRICTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </Select>
        <Select
          value={v.category}
          onChange={(e) => set("category", e.target.value as Category)}
        >
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
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
      <Select
        value={v.rating ?? ""}
        onChange={(e) =>
          set("rating", e.target.value ? Number(e.target.value) : null)
        }
      >
        <option value="">Đánh giá (sao)</option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {"★".repeat(n)}
          </option>
        ))}
      </Select>
      {(create.error || update.error) && (
        <p className="text-sm text-red-600">Không lưu được. Kiểm tra link (phải https) & thử lại.</p>
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
