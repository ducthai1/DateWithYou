"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

import type { LatLng } from "@/lib/maps";
import { useToast } from "@/components/ui/toast";

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
  const toast = useToast();
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
    toast("Đã lưu địa điểm ✓", "success");
    onDone();
  };
  /*
   * Two sources, deliberately. The space's own list is what its members
   * actually file places under and stays at the top. The official ward list is
   * 3,320 entries and cannot be shipped to the browser, so it is queried as the
   * person types and appended below — which is also why filtering is disabled
   * on the client side here (see Select.onSearch).
   */
  const [areaQuery, setAreaQuery] = useState("");
  const areaSearch = trpc.location.searchAreas.useQuery(
    { query: areaQuery },
    { enabled: areaQuery.trim().length > 1, staleTime: 5 * 60 * 1000 },
  );
  const areaOptions = useMemo(() => {
    const own = districts.map((d) => ({ value: d, label: d }));
    const seen = new Set(own.map((o) => o.value));
    const official = (areaSearch.data ?? [])
      .filter((a) => !seen.has(a.value))
      .map((a) => ({ value: a.value, label: a.label }));
    // A value already saved on this place must stay selectable even when it is
    // in neither list — otherwise editing an old pin silently clears its area.
    const current = v.district && !seen.has(v.district)
      && !official.some((o) => o.value === v.district)
      ? [{ value: v.district, label: v.district }]
      : [];
    return [...current, ...own, ...official];
  }, [districts, areaSearch.data, v.district]);

  const onError = (err: { message?: string }) =>
    toast("Lưu thất bại: " + (err?.message || "Thử lại nhé"), "error");
  const create = trpc.location.create.useMutation({ onSuccess, onError });
  const update = trpc.location.update.useMutation({ onSuccess, onError });
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
    <div className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-sm">
      <Input
        placeholder="Tên quán"
        value={v.name}
        onChange={(e) => set("name", e.target.value)}
      />
      {/* Stack on mobile (<sm) so each select gets its full width. Side-by-side on sm+. */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select
          aria-label="Khu vực"
          value={v.district}
          onChange={(val) => set("district", val)}
          options={areaOptions}
          searchable
          onSearch={setAreaQuery}
          searchPlaceholder="Tìm phường, xã…"
          emptyLabel="Không tìm thấy khu vực"
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
      <div className="-mt-2 px-1 space-y-1">
        <p className="text-xs text-muted-foreground">
          Dán link Google Maps/Apple Maps để tự lấy toạ độ. Vị trí lấy từ link có thể{" "}
          <span className="font-medium text-foreground">gần đúng</span> — chạm bản đồ để đặt pin chính xác.
        </p>
        {v.googleMapsUrl.trim().startsWith("http") && (
          <a
            href={v.googleMapsUrl.trim()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-medium text-accent underline"
          >
            ↗ Mở link để xem đúng vị trí (rồi chạm bản đồ cho khớp)
          </a>
        )}
      </div>
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
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground ml-1 mb-2 block">Giờ mở cửa</label>
          <Input
            type="time"
            value={v.openTime}
            onChange={(e) => set("openTime", e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground ml-1 mb-2 block">Giờ đóng cửa</label>
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
      {/* Pinned to the foot of whatever is scrolling this form.
          The form runs name, two selects, two links, must-try, opening hours
          and a rating, so in the desktop panel and in the phone sheet alike the
          save button sat below the fold — you had to scroll past everything you
          had just filled in to commit it. */}
      <div className="bg-card border-border sticky bottom-0 -mx-1 flex gap-2 border-t px-1 pt-3 pb-1">
        <Button onClick={submit} disabled={!v.name.trim() || pending} className="flex-1">
          {pending ? "Đang lưu…" : v.id ? "Cập nhật" : "Thêm địa điểm"}
        </Button>
        <Button variant="ghost" onClick={onCancel} className="shrink-0">
          Huỷ
        </Button>
      </div>
    </div>
  );
}
