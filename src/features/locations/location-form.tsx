"use client";

import { useEffect, useMemo, useState } from "react";
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
  onPickOnMap,
}: {
  initial?: Partial<LocationFormValues>;
  categories: string[];
  districts: string[];
  onDone: () => void;
  onCancel: () => void;
  /** Step aside so a point can be tapped on the map, then come back with it. */
  onPickOnMap?: () => void;
}) {
  const toast = useToast();
  const [v, setV] = useState<LocationFormValues>({
    ...empty,
    // Not `districts[0]`. Seeding from the space's own hand-typed list put a
    // ward nobody chose on every new place, and it was usually wrong — the
    // official list is searchable and a blank field asks rather than assumes.
    district: initial?.district || "",
    category: initial?.category || categories[0] || "",
    ...initial,
  });
  /*
   * A point tapped on the map after this form opened has to land in it.
   *
   * `useState` reads its argument once, so `initial.geo` changing later did
   * nothing at all: tapping the map moved the draft pin and updated the parent,
   * while the form quietly kept whatever it had — usually nothing — and saved
   * the place with no coordinates.
   */
  const incomingGeo = initial?.geo ?? null;
  useEffect(() => {
    if (!incomingGeo) return;
    setV((p) =>
      p.geo && p.geo.lat === incomingGeo.lat && p.geo.lng === incomingGeo.lng
        ? p
        : { ...p, geo: incomingGeo },
    );
  }, [incomingGeo]);

  /*
   * A point on the map names its own area, so stop asking for it by hand.
   *
   * Only fills a field that is still empty: someone who has already chosen an
   * area meant it, and a lookup that disagrees is not grounds to overwrite
   * them. Nothing waits on it either — the reverse lookup is best-effort and
   * the place saves fine without it.
   */
  const areaAt = trpc.location.areaAt.useQuery(
    { lat: v.geo?.lat ?? 0, lng: v.geo?.lng ?? 0 },
    { enabled: !!v.geo && !v.district, staleTime: 60 * 60 * 1000, retry: false },
  );
  const suggestedArea = areaAt.data?.value ?? null;
  useEffect(() => {
    if (!suggestedArea) return;
    setV((p) => (p.district ? p : { ...p, district: suggestedArea }));
  }, [suggestedArea]);

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
    // The official list first now: it is the authority, and the space's own
    // hand-typed entries are a convenience beside it rather than the default.
    return [...current, ...official, ...own];
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
      {onPickOnMap ? (
        // In a dialog the map is behind the scrim, so "tap the map" is an
        // instruction you cannot follow. The button steps the dialog aside and
        // brings it back with the point.
        <button
          type="button"
          onClick={onPickOnMap}
          className="border-border hover:bg-muted text-muted-foreground focus-visible:ring-ring/50 flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs transition-colors outline-none focus-visible:ring-2"
        >
          <span>
            {v.geo
              ? `📍 ${v.geo.lat.toFixed(4)}, ${v.geo.lng.toFixed(4)}`
              : "Chưa có vị trí trên bản đồ"}
          </span>
          <span className="text-accent font-medium">
            {v.geo ? "Chọn lại" : "Chọn trên bản đồ"}
          </span>
        </button>
      ) : (
        <p className="text-muted-foreground text-xs">
          {v.geo
            ? `📍 ${v.geo.lat.toFixed(4)}, ${v.geo.lng.toFixed(4)} (chạm bản đồ để đổi)`
            : "Chạm lên bản đồ để chọn vị trí"}
        </p>
      )}
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
      {/* -mx-5/-mb-5 cancels the card's own p-5 so the bar reaches the card's
          edges: a strip that stops short of them lets the field above show
          through at the sides, which is what made it read as translucent. */}
      <div className="bg-card border-border sticky bottom-0 -mx-5 -mb-5 flex gap-2 rounded-b-2xl border-t px-5 pt-3 pb-5 shadow-[0_-8px_16px_-12px_rgba(59,50,42,0.25)]">
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
