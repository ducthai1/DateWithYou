"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  MapPinned,
  Link2,
  Navigation,
  ExternalLink,
  Pencil,
  Trash2,
  Utensils,
  Play,
  Square,
  Clock,
  Route,
  Settings,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { useLiveNavigation } from "./use-live-navigation";
import { LocationSettingsModal } from "./location-settings-modal";
import { CATEGORY_META } from "@/lib/category-meta";

// Shared styling for the small icon+label actions on a location card.
const ACTION_CLS =
  "inline-flex items-center gap-1 rounded-lg px-2 py-1 transition-colors";
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [routeGeometry, setRouteGeometry] = useState<unknown>(null);
  const [focusGeo, setFocusGeo] = useState<LatLng | null>(null);
  const [userGeo, setUserGeo] = useState<LatLng | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<number | null>(null);
  const [routeDurationSeconds, setRouteDurationSeconds] = useState<number | null>(null);
  const nav = useLiveNavigation();

  // Live position wins whenever we have one (and persists after Dừng so the
  // marker doesn't jump back to the route origin); otherwise the route origin.
  const liveUser = nav.userGeo ?? userGeo;

  const utils = trpc.useUtils();
  const configQuery = trpc.location.getConfig.useQuery();
  const categories = configQuery.data?.categories || [];
  const districts = configQuery.data?.districts || [];

  const list = trpc.location.list.useQuery({
    district: district || undefined,
    category: category || undefined,
    status: (status || undefined) as "want_to_go" | "visited" | undefined,
  });
  const toggle = trpc.location.toggleStatus.useMutation({
    onSuccess: () => utils.location.list.invalidate(),
  });
  const remove = trpc.location.remove.useMutation({
    onSuccess: () => utils.location.list.invalidate(),
  });

  // In-app "Chỉ đường": select the pin, fly to it, then get the user's location
  // and draw the route. Errors surface to the user instead of failing silently.
  function goToLocation(id: string, dest: LatLng | null) {
    if (!dest) return;
    setSelectedId(id);
    setFocusGeo({ ...dest }); // new object each call so the map re-flies
    
    // Cuộn màn hình tới bản đồ trên thiết bị di động
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      document.getElementById("map-view")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    setRouteError(null);
    setRouteGeometry(null);
    if (!navigator.geolocation) {
      setRouteError("Trình duyệt không hỗ trợ định vị.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserGeo(origin);
        try {
          const r = await utils.location.getRoute.fetch({ destinationId: id, origin });
          setRouteGeometry(r.geometry);
          setRouteDistanceMeters(r.distanceMeters);
          setRouteDurationSeconds(r.durationSeconds);
          // Feed the route polyline to the nav hook so it can compute remaining distance.
          const coords = (r.geometry as { coordinates?: Array<[number, number]> }).coordinates;
          if (coords) {
            nav.setRouteInfo(coords, r.distanceMeters, r.durationSeconds);
          }
        } catch {
          setRouteError("Không vẽ được đường đi (kiểm tra STADIA_API_KEY).");
        }
      },
      (err) => {
        // Report the real cause — the permission may be granted yet the OS still
        // can't produce a fix (Location Services off, or the lookup timed out).
        setRouteError(
          err.code === err.PERMISSION_DENIED
            ? "Trang bị chặn quyền vị trí — mở ổ khoá trên thanh địa chỉ để cho phép."
            : err.code === err.POSITION_UNAVAILABLE
              ? "Máy chưa trả được vị trí — bật Location Services (macOS: Cài đặt › Quyền riêng tư › Dịch vụ vị trí) cho trình duyệt rồi thử lại."
              : "Lấy vị trí quá lâu, thử lại nhé.",
        );
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  }

  const pins = (list.data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    geo: l.geo,
    status: l.status,
  }));

  // Format helpers for the HUD.
  const fmtDistance = (m: number | null) => {
    if (m == null) return "--";
    return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
  };
  const fmtDuration = (s: number | null) => {
    if (s == null) return "--";
    const mins = Math.ceil(s / 60);
    if (mins < 60) return `${mins} phút`;
    const h = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${h}h ${rem}p` : `${h}h`;
  };

  // Prefer live remaining values; fall back to initial route totals.
  const displayDistance = nav.remainingMeters ?? routeDistanceMeters;
  const displayDuration = nav.remainingSeconds ?? routeDurationSeconds;

  return (
    <>
      {/* ── Fullscreen navigation overlay ── */}
      {nav.isNavigating && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          {/* Map fills the entire viewport */}
          <div className="relative flex-1">
            <LocationMapView
              pins={pins}
              routeGeometry={routeGeometry}
              selectedId={selectedId}
              focusGeo={focusGeo}
              userGeo={liveUser}
              followGeo={nav.userGeo}
              heading={nav.heading}
              traveled={nav.traveled}
              onSelect={setSelectedId}
              className="min-h-0 rounded-none border-0 shadow-none"
            />

            {/* ── Navigation HUD: distance + ETA ── */}
            <div
              className="absolute inset-x-0 top-0 flex items-center justify-center gap-4 p-3"
              style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
            >
              <div className="flex items-center gap-4 rounded-2xl bg-white/90 px-5 py-2.5 shadow-lg backdrop-blur-sm">
                <div className="flex items-center gap-1.5">
                  <Route className="h-4 w-4 text-accent" />
                  <span className="text-sm font-semibold">{fmtDistance(displayDistance)}</span>
                </div>
                <div className="h-5 w-px bg-border" />
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-accent" />
                  <span className="text-sm font-semibold">{fmtDuration(displayDuration)}</span>
                </div>
              </div>
            </div>

            {/* Floating stop button — always visible over the map */}
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-4"
                 style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
            >
              {(routeError || nav.error) && (
                <p className="bg-black/60 text-destructive rounded-lg px-3 py-1.5 text-xs backdrop-blur-sm">
                  {routeError ?? nav.error}
                </p>
              )}
              <Button
                variant="outline"
                className="text-destructive border-destructive/30 hover:bg-destructive-soft w-full max-w-sm gap-2 bg-white/90 shadow-lg backdrop-blur-sm"
                onClick={nav.stop}
              >
                <Square className="h-4 w-4" /> Dừng theo dõi
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Normal page layout ── */}
      <div className="mx-auto max-w-2xl px-4 py-6 lg:max-w-6xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bản đồ ăn chơi</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => {
              setFormInitial({});
              setFormOpen((o) => !o);
            }}
          >
            {formOpen ? "Đóng" : "+ Thêm"}
          </Button>
        </div>
      </div>

      {/* Desktop: map + filters pinned left, list scrolls on the right. */}
      {/* Mobile: filters top, list middle, map bottom */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
        <div className="contents lg:block lg:sticky lg:top-6 lg:self-start lg:space-y-3">
          <div className="order-1 grid grid-cols-3 gap-2 lg:order-none">
            <Select
              aria-label="Lọc theo quận"
              value={district}
              onChange={setDistrict}
              options={[
                { value: "", label: "Quận" },
                ...districts.map((d) => ({ value: d, label: d })),
              ]}
            />
            <Select
              aria-label="Lọc theo danh mục"
              value={category}
              onChange={setCategory}
              options={[
                { value: "", label: "Danh mục" },
                ...categories.map((c) => ({ value: c, label: c })),
              ]}
            />
            <Select
              aria-label="Lọc theo trạng thái"
              value={status}
              onChange={setStatus}
              options={[
                { value: "", label: "Tất cả" },
                { value: "want_to_go", label: "Muốn đi" },
                { value: "visited", label: "Đã đi" },
              ]}
            />
          </div>

          <div className="order-3 space-y-3 lg:order-none">
            <div id="map-view" className="h-72 lg:h-[calc(100dvh-13rem)]">
            <LocationMapView
              pins={pins}
              routeGeometry={routeGeometry}
              selectedId={selectedId}
              focusGeo={focusGeo}
              userGeo={liveUser}
              followGeo={nav.isNavigating ? nav.userGeo : null}
              heading={nav.isNavigating ? nav.heading : null}
              traveled={nav.traveled}
              onSelect={setSelectedId}
              onMapClick={(geo) =>
                formOpen && setFormInitial((p) => ({ ...p, geo }))
              }
            />
          </div>

          {/* Follow-me controls appear once a route is on the map. */}
          {routeGeometry != null &&
            (nav.isNavigating ? (
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive-soft w-full gap-2"
                onClick={nav.stop}
              >
                <Square className="h-4 w-4" /> Dừng theo dõi
              </Button>
            ) : (
              <Button
                className="w-full gap-2"
                onClick={() => {
                  setFocusGeo(null); // hand the camera to follow-mode, no fly/ease clash
                  nav.start();
                }}
              >
                <Play className="h-4 w-4" /> Bắt đầu đi
              </Button>
            ))}
          {(routeError || nav.error) && (
            <p className="text-destructive text-xs">{routeError ?? nav.error}</p>
          )}
          </div>
        </div>

        <div className="order-2 space-y-4 lg:order-none">
          <AnimatePresence initial={false}>
            {formOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0, overflow: "hidden" }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0, overflow: "hidden" }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <div className="py-2">
                  <LocationForm
                    initial={formInitial}
                    categories={categories}
                    districts={districts}
                    onDone={() => setFormOpen(false)}
                    onCancel={() => setFormOpen(false)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {list.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : pins.length === 0 ? (
            <div className="border-border text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center text-sm">
              <MapPinned className="h-8 w-8 opacity-50" />
              <p>
                Chưa có địa điểm nào.
                <br />
                Bấm “+ Thêm” để lưu chỗ hẹn hò đầu tiên.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(list.data ?? []).map((l) => {
                const meta =
                  CATEGORY_META[l.category as Category] ??
                  CATEGORY_META["Khác"];
                const Icon = meta.Icon;
                return (
                  <Card
                    key={l.id}
                    className={`flex h-full flex-col gap-3 p-4 transition-shadow hover:shadow-md ${selectedId === l.id ? "ring-accent ring-2" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.className}`}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate font-medium">{l.name}</p>
                          <button
                            onClick={() => toggle.mutate({ id: l.id })}
                            className={cn(
                              "shrink-0 relative inline-flex items-center w-24 h-[26px] rounded-full border px-2.5 text-xs font-medium transition-all duration-300 hover:scale-[1.03] active:scale-95 shadow-sm overflow-hidden",
                              l.status === "visited"
                                ? "border-success/30 bg-success/10 text-success hover:bg-success/20"
                                : "border-border bg-card text-muted-foreground hover:border-accent hover:text-accent hover:bg-accent/5 hover:shadow-md"
                            )}
                            title="Bấm để đổi trạng thái"
                            aria-label="Đổi trạng thái muốn đi / đã đi"
                          >
                            {/* Fixed Icon Container */}
                            <div className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                              <Circle
                                className={cn(
                                  "absolute h-3.5 w-3.5 transition-all duration-300",
                                  l.status === "visited" ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
                                )}
                              />
                              <CheckCircle2
                                className={cn(
                                  "absolute h-3.5 w-3.5 transition-all duration-300",
                                  l.status === "visited" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
                                )}
                              />
                            </div>

                            {/* Text Container */}
                            <div className="relative flex-1 h-full flex items-center justify-center pl-0.5">
                              <span
                                className={cn(
                                  "absolute whitespace-nowrap transition-all duration-300",
                                  l.status === "visited" ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
                                )}
                              >
                                Muốn đi
                              </span>
                              <span
                                className={cn(
                                  "absolute whitespace-nowrap transition-all duration-300",
                                  l.status === "visited" ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
                                )}
                              >
                                Đã đi
                              </span>
                            </div>
                          </button>
                        </div>
                        {l.rating ? (
                          <p className="text-sm leading-none">
                            <span className="text-amber-500">
                              {"★".repeat(l.rating)}
                            </span>
                            <span className="text-muted-foreground/30">
                              {"★".repeat(5 - l.rating)}
                            </span>
                          </p>
                        ) : null}
                        <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1 text-xs">
                          <span>
                            {l.district} · {l.category}
                          </span>
                          {l.mustTry && (
                            <span className="flex items-center gap-0.5">
                              <span aria-hidden>·</span>
                              <Utensils className="h-3 w-3" />
                              {l.mustTry}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="border-border/70 mt-auto flex flex-wrap items-center gap-1 border-t pt-2 text-xs">
                      {l.socialUrl && (
                        <a
                          className={`${ACTION_CLS} text-accent hover:bg-accent-soft`}
                          href={l.socialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Link2 className="h-3.5 w-3.5" /> Review
                        </a>
                      )}
                      {/* In-app: pan the map to the pin and draw the route. */}
                      {l.geo && (
                        <button
                          className={`${ACTION_CLS} text-accent hover:bg-accent-soft`}
                          onClick={() => goToLocation(l.id, l.geo)}
                        >
                          <Navigation className="h-3.5 w-3.5" /> Chỉ đường
                        </button>
                      )}
                      {/* External: open the real maps app (turn-by-turn). Prefers
                          the hand-pasted link, falls back to coordinates. */}
                      {(l.googleMapsUrl || l.geo) && (
                        <a
                          className={`${ACTION_CLS} text-muted-foreground hover:bg-muted`}
                          href={
                            l.googleMapsUrl ??
                            (l.geo
                              ? prefersAppleMaps()
                                ? appleMapsDirectionsUrl(l.geo)
                                : googleMapsDirectionsUrl(l.geo)
                              : "#")
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Mở Maps
                        </a>
                      )}
                      <button
                        className={`${ACTION_CLS} text-muted-foreground hover:bg-muted`}
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
                        <Pencil className="h-3.5 w-3.5" /> Sửa
                      </button>
                      <ConfirmButton
                        className={`${ACTION_CLS} ml-auto hover:bg-destructive-soft`}
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        onConfirm={() => remove.mutate({ id: l.id })}
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
        </div>
      </div>

      {settingsOpen && (
        <LocationSettingsModal
          initialCategories={configQuery.data?.categories ?? []}
          initialDistricts={configQuery.data?.districts ?? []}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}
