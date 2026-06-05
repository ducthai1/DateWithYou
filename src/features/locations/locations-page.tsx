"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  DISTRICTS,
  CATEGORIES,
  type District,
  type Category,
} from "@/lib/districts-categories";
import {
  appleMapsDirectionsUrl,
  googleMapsDirectionsUrl,
  prefersAppleMaps,
  type LatLng,
} from "@/lib/maps";
import { LocationMapView } from "./location-mapview";
import { LocationForm, type LocationFormValues } from "./location-form";

export function LocationsPage() {
  const [district, setDistrict] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<Partial<LocationFormValues>>({});
  const [routeGeometry, setRouteGeometry] = useState<unknown>(null);

  const utils = trpc.useUtils();
  const list = trpc.location.list.useQuery({
    district: (district || undefined) as District | undefined,
    category: (category || undefined) as Category | undefined,
    status: (status || undefined) as "want_to_go" | "visited" | undefined,
  });
  const toggle = trpc.location.toggleStatus.useMutation({
    onSuccess: () => utils.location.list.invalidate(),
  });
  const remove = trpc.location.remove.useMutation({
    onSuccess: () => utils.location.list.invalidate(),
  });

  async function showRoute(destinationId: string, dest: LatLng | null) {
    if (!dest) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await utils.location.getRoute.fetch({
            destinationId,
            origin: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          });
          setRouteGeometry(r.geometry);
        } catch {
          setRouteGeometry(null);
        }
      },
      () => setRouteGeometry(null),
      { timeout: 8000 },
    );
  }

  const pins = (list.data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    geo: l.geo,
    status: l.status,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bản đồ ăn chơi</h1>
        <Button
          onClick={() => {
            setFormInitial({});
            setFormOpen((o) => !o);
          }}
        >
          {formOpen ? "Đóng" : "+ Thêm"}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Select value={district} onChange={(e) => setDistrict(e.target.value)}>
          <option value="">Quận</option>
          {DISTRICTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Danh mục</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tất cả</option>
          <option value="want_to_go">Muốn đi</option>
          <option value="visited">Đã đi</option>
        </Select>
      </div>

      <div className="h-72">
        <LocationMapView
          pins={pins}
          routeGeometry={routeGeometry}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMapClick={(geo) =>
            formOpen && setFormInitial((p) => ({ ...p, geo }))
          }
        />
      </div>

      {formOpen && (
        <LocationForm
          initial={formInitial}
          onDone={() => setFormOpen(false)}
          onCancel={() => setFormOpen(false)}
        />
      )}

      {list.isLoading ? (
        <p className="text-muted-foreground text-sm">Đang tải…</p>
      ) : pins.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Chưa có địa điểm nào. Bấm “+ Thêm” để bắt đầu.
        </p>
      ) : (
        <ul className="space-y-3">
          {(list.data ?? []).map((l) => (
            <li
              key={l.id}
              className={`border-border rounded-xl border p-3 ${selectedId === l.id ? "ring-accent ring-1" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {l.name}{" "}
                    {l.rating ? (
                      <span className="text-amber-500">{"★".repeat(l.rating)}</span>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {l.district} · {l.category}
                    {l.mustTry ? ` · 🍽 ${l.mustTry}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => toggle.mutate({ id: l.id })}
                  className={`shrink-0 rounded-full px-2 py-1 text-xs ${
                    l.status === "visited"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {l.status === "visited" ? "Đã đi" : "Muốn đi"}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {l.socialUrl && (
                  <a className="text-accent" href={l.socialUrl} target="_blank" rel="noopener noreferrer">
                    Review
                  </a>
                )}
                {l.geo && (
                  <>
                    <a
                      className="text-accent"
                      href={
                        prefersAppleMaps()
                          ? appleMapsDirectionsUrl(l.geo)
                          : googleMapsDirectionsUrl(l.geo)
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Chỉ đường
                    </a>
                    <button className="text-accent" onClick={() => showRoute(l.id, l.geo)}>
                      Xem đường
                    </button>
                  </>
                )}
                <button
                  className="text-muted-foreground"
                  onClick={() => {
                    setFormInitial({
                      id: l.id,
                      name: l.name,
                      district: l.district,
                      category: l.category,
                      geo: l.geo,
                      googleMapsUrl: l.googleMapsUrl ?? "",
                      socialUrl: l.socialUrl ?? "",
                      mustTry: l.mustTry ?? "",
                      rating: l.rating,
                      note: l.note ?? "",
                    });
                    setFormOpen(true);
                  }}
                >
                  Sửa
                </button>
                <button
                  className="text-red-500"
                  onClick={() => remove.mutate({ id: l.id })}
                >
                  Xoá
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
