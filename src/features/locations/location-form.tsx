"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { readableFormError } from "@/lib/form-error";
import { Button } from "@/components/ui/button";
import { ModalContent, ModalFooter } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

import { cn } from "@/lib/utils";
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
  /*
   * Whether the point was set during this editing session — by a tap on the
   * map, a pick from search, or a link that resolved.
   *
   * This has to be recorded rather than inferred. The submit below used to
   * decide "the person left the pin alone" by comparing `v.geo === initial.geo`,
   * and those two are the SAME OBJECT once the effect below copies one into the
   * other. So a tap on the map read as "untouched", and on a create with a
   * pasted link the form sent `geo: undefined` — asking the server to derive the
   * pin from the link instead. For anyone who tapped the map precisely BECAUSE
   * the link would not resolve, that threw away the only coordinate there was,
   * and the place saved with no position at all.
   */
  const geoTouched = useRef(false);
  useEffect(() => {
    if (!incomingGeo) return;
    geoTouched.current = true;
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
  /*
   * A pasted link is resolved here, not left for the save to discover.
   *
   * The coordinates inside a Maps link can only be read on the server (short
   * links need redirects followed, and a mobile "Share" link carries no coords
   * at all — its place name has to be geocoded). That used to happen during
   * the save, which meant the browser held no `geo`, the area lookup below
   * never ran, the area stayed blank, and the save was rejected for it. So the
   * paste is resolved up front: the pin drops, the area fills itself, and the
   * save has everything it needs before it is pressed.
   */
  const [linkToResolve, setLinkToResolve] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setLinkToResolve(v.googleMapsUrl.trim()), 400);
    return () => clearTimeout(t);
  }, [v.googleMapsUrl]);
  const linkGeo = trpc.location.geoFromUrl.useQuery(
    { url: linkToResolve },
    {
      enabled: /^https?:\/\//i.test(linkToResolve) && !v.geo,
      // A link resolves to one place forever; re-asking on every re-render of
      // the dialog would be pure latency.
      staleTime: Infinity,
      retry: false,
    },
  );
  const resolvedGeo = linkGeo.data ?? null;
  useEffect(() => {
    if (!resolvedGeo) return;
    geoTouched.current = true;
    setV((p) => (p.geo ? p : { ...p, geo: resolvedGeo }));
  }, [resolvedGeo]);
  const resolvingLink = linkGeo.isFetching;
  const linkHadNoGeo = !!linkToResolve && linkGeo.isFetched && !linkGeo.isFetching && !resolvedGeo && !v.geo;

  const areaAt = trpc.location.areaAt.useQuery(
    { lat: v.geo?.lat ?? 0, lng: v.geo?.lng ?? 0 },
    { enabled: !!v.geo && !v.district, staleTime: 60 * 60 * 1000, retry: false },
  );
  const suggestedArea = areaAt.data?.value ?? null;
  useEffect(() => {
    if (!suggestedArea) return;
    setV((p) => (p.district ? p : { ...p, district: suggestedArea }));
  }, [suggestedArea]);

  /*
   * Add a category without leaving the dialog.
   *
   * updateConfig replaces the whole config, so the districts have to be sent
   * back untouched alongside — sending only the categories would wipe the
   * space's saved areas.
   */
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const utilsForConfig = trpc.useUtils();
  const saveConfig = trpc.location.updateConfig.useMutation({
    onSuccess: (_d, vars) => {
      utilsForConfig.location.getConfig.invalidate();
      // Select the one just added, so the reason for adding it is carried out.
      const added = vars.categories[vars.categories.length - 1];
      setV((p) => ({ ...p, category: added }));
      setNewCategory("");
      setAddingCategory(false);
      toast("Đã thêm loại địa điểm ✓", "success");
    },
    onError: (err) => toast(readableFormError(err.message), "error"),
  });
  const addCategoryPending = saveConfig.isPending;
  function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    if (categories.some((c) => c.toLowerCase() === name.toLowerCase())) {
      setV((p) => ({ ...p, category: name }));
      setNewCategory("");
      setAddingCategory(false);
      return;
    }
    saveConfig.mutate({ categories: [...categories, name], districts });
  }

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
    toast("Lưu thất bại: " + readableFormError(err?.message), "error");
  const create = trpc.location.create.useMutation({ onSuccess, onError });
  const update = trpc.location.update.useMutation({ onSuccess, onError });
  const pending = create.isPending || update.isPending;

  function submit() {
    /*
     * Checked here so the answer names the box, not the schema.
     *
     * The area is filled in by the server from the place's own coordinates, so
     * it is never the person's job. The category is: nothing can derive it, and
     * letting an empty one reach the server only bought the same unreadable
     * validation dump the area used to produce.
     */
    if (!v.category.trim()) {
      toast("Chọn loại địa điểm giúp mình nhé", "error");
      return;
    }
    const payload = {
      name: v.name.trim(),
      district: v.district,
      category: v.category,
      /*
       * Withholding the point means "server, work it out from the link", and
       * only one situation wants that: editing a place that already exists,
       * where the link was changed and the pin was deliberately left alone.
       *
       * `v.id` is what makes it an edit. Without that check a create went down
       * this path too, and a create is exactly when there is no stored pin to
       * fall back on.
       */
      geo: (v.id && !geoTouched.current && v.googleMapsUrl.trim() !== (initial?.googleMapsUrl ?? "").trim())
        ? undefined
        : (v.geo ?? undefined),
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
    // ModalContent, not a card of its own: nested inside a dialog this drew a
    // second bordered panel, and its own sticky footer floated in the middle of
    // the fields because the dialog — not the form — owns the scroll box.
    <>
      <ModalContent className="space-y-4">
        <Input
          placeholder="Tên quán"
          value={v.name}
          onChange={(e) => set("name", e.target.value)}
        />
        {/* Its own row. An official ward reads "Phường An Khánh, Thành phố Hồ
            Chí Minh" — long enough that sharing a row with the category pushed
            the pair past the panel's width the moment an area was chosen. */}
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
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Select
              aria-label="Danh mục"
              className="min-w-0 flex-1"
              value={v.category}
              onChange={(val) => set("category", val)}
              options={categories.map((c) => ({ value: c, label: c }))}
            />
            {/* Adding a category used to mean closing this dialog, opening
                settings, saving, and starting the place over. */}
            <button
              type="button"
              aria-label="Thêm loại địa điểm"
              title="Thêm loại địa điểm"
              onClick={() => setAddingCategory((a) => !a)}
              className="border-border bg-card hover:bg-muted focus-visible:ring-ring/50 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border shadow-sm transition-all outline-none focus-visible:ring-2 active:scale-[.98]"
            >
              <Plus className={cn("h-4 w-4 transition-transform", addingCategory && "rotate-45")} />
            </button>
          </div>
          {addingCategory ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                placeholder="Tên loại mới (vd: Lẩu nướng)"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addCategory(); }
                  if (e.key === "Escape") { e.preventDefault(); setAddingCategory(false); }
                }}
              />
              <Button
                type="button"
                onClick={addCategory}
                disabled={!newCategory.trim() || addCategoryPending}
                className="h-10 shrink-0 px-3"
              >
                {addCategoryPending ? "Đang thêm…" : "Thêm"}
              </Button>
            </div>
          ) : null}
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
          {resolvingLink && (
            <p className="text-accent text-xs font-medium">Đang lấy vị trí từ link…</p>
          )}
          {linkHadNoGeo && (
            <p className="text-xs font-medium text-amber-600">
              Link này không đọc được vị trí — chạm lên bản đồ để đặt pin, hoặc chọn khu vực ở trên.
            </p>
          )}
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
      </ModalContent>
      <ModalFooter>
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          Huỷ
        </Button>
        <Button onClick={submit} disabled={!v.name.trim() || pending} className="flex-1">
          {pending ? "Đang lưu…" : v.id ? "Cập nhật" : "Thêm địa điểm"}
        </Button>
      </ModalFooter>
    </>
  );
}
