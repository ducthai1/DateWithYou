"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
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
  WifiOff,
  Loader2,
  Users,
  UserRound,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerList } from "@/components/ui/stagger-list";
import { useLiveNavigation } from "./use-live-navigation";
import { useNavigationInvites } from "./use-navigation-invites";
import { LocationSettingsModal } from "./location-settings-modal";
import { CATEGORY_META } from "@/lib/category-meta";
import type { Category } from "@/lib/districts-categories";

// Shared styling for the small icon+label actions on a location card.
const ACTION_CLS =
  "inline-flex items-center gap-1 rounded-lg px-2 py-1 transition-colors";
import {
  appleMapsDirectionsUrl,
  googleMapsDirectionsUrl,
  prefersAppleMaps,
  type LatLng,
} from "@/lib/maps";
import { authClient } from "@/lib/auth-client";
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
  
  const [partnerRouteGeometry, setPartnerRouteGeometry] = useState<unknown>(null);
  const [partnerRouteDistanceMeters, setPartnerRouteDistanceMeters] = useState<number | null>(null);
  const [partnerRouteDurationSeconds, setPartnerRouteDurationSeconds] = useState<number | null>(null);
  
  const isRecalculating = useRef(false);

  // ── Companion navigation ("Cùng khởi hành") ──
  const [showCompanionChoice, setShowCompanionChoice] = useState(false);
  const [companionLocationId, setCompanionLocationId] = useState<string | null>(null);
  const [companionLocationName, setCompanionLocationName] = useState("");
  const [pendingSentInviteId, setPendingSentInviteId] = useState<string | null>(null);
  const [showIncomingInvite, setShowIncomingInvite] = useState(false);
  const navInvites = useNavigationInvites();
  const sendInvite = trpc.location.sendNavInvite.useMutation();
  const respondInvite = trpc.location.respondNavInvite.useMutation();
  const cancelInvite = trpc.location.cancelNavInvite.useMutation();
  
  const nav = useLiveNavigation({
    onOffRoute: async (currentGeo) => {
      if (!selectedId || isRecalculating.current) return;
      isRecalculating.current = true;
      try {
        const r = await utils.location.getRoute.fetch({ destinationId: selectedId, origin: currentGeo });
        setRouteGeometry(r.geometry);
        setRouteDistanceMeters(r.distanceMeters);
        setRouteDurationSeconds(r.durationSeconds);
        const coords = (r.geometry as { coordinates?: Array<[number, number]> }).coordinates;
        if (coords) {
          nav.setRouteInfo(coords, r.distanceMeters, r.durationSeconds);
        }
      } catch (err) {
        console.error("Lỗi tính lại đường đi", err);
      } finally {
        // Wait a bit before allowing another recalculation to avoid spamming
        setTimeout(() => { isRecalculating.current = false; }, 5000);
      }
    }
  });

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
  
  const { data: session } = authClient.useSession();
  const members = trpc.space.members.useQuery();
  
  const userAvatar = session?.user.image || undefined;
  const partnerAvatar = members.data?.find((m) => m.id !== session?.user.id)?.image || undefined;
  const hasTwoMembers = (members.data?.length ?? 0) >= 2;

  // ── SSE event handlers ──

  // When an incoming invite is detected via SSE, show the modal.
  useEffect(() => {
    if (navInvites.incomingInvite && navInvites.incomingInvite.status === "pending") {
      setShowIncomingInvite(true);
    }
  }, [navInvites.incomingInvite]);

  // When our sent invite gets accepted, auto-start navigation.
  useEffect(() => {
    if (
      navInvites.inviteResponse &&
      navInvites.inviteResponse.status === "accepted" &&
      navInvites.inviteResponse.id === pendingSentInviteId
    ) {
      // Partner accepted! Find the location and start navigation.
      const locId = navInvites.inviteResponse.locationId;
      const loc = list.data?.find((l) => l.id === locId);
      if (loc?.geo) {
        goToLocation(loc.id, loc.geo);
        // Auto-start live tracking after a short delay for route to load.
        setTimeout(() => {
          setFocusGeo(null);
          nav.start();
        }, 2000);
      }
      setPendingSentInviteId(null);
      navInvites.clearResponse();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navInvites.inviteResponse, pendingSentInviteId]);

  // Handle sending a companion invite.
  const handleSendCompanionInvite = useCallback(
    async (locationId: string, locationName: string) => {
      try {
        const result = await sendInvite.mutateAsync({ locationId, locationName });
        setPendingSentInviteId(result.id);
        setShowCompanionChoice(false);
      } catch (err) {
        console.error("Failed to send invite", err);
        setShowCompanionChoice(false);
      }
    },
    [sendInvite],
  );

  // Handle responding to an incoming invite.
  const handleRespondToInvite = useCallback(
    async (inviteId: string, accept: boolean) => {
      try {
        const result = await respondInvite.mutateAsync({ inviteId, accept });
        setShowIncomingInvite(false);
        navInvites.clearIncoming();

        if (accept && result.locationId) {
          // Accepted! Navigate to the location.
          const loc = list.data?.find((l) => l.id === result.locationId);
          if (loc?.geo) {
            goToLocation(loc.id, loc.geo);
            setTimeout(() => {
              setFocusGeo(null);
              nav.start();
            }, 2000);
          }
        }
      } catch (err) {
        console.error("Failed to respond to invite", err);
        setShowIncomingInvite(false);
        navInvites.clearIncoming();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [respondInvite, list.data],
  );

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
          const reqs = [utils.location.getRoute.fetch({ destinationId: id, origin })];
          
          // If partner is currently active, fetch a route for them too
          if (nav.partnerLocation) {
            reqs.push(utils.location.getRoute.fetch({ 
              destinationId: id, 
              origin: { lat: nav.partnerLocation.lat, lng: nav.partnerLocation.lng } 
            }));
          }

          const [r, partnerR] = await Promise.all(reqs);

          setRouteGeometry(r.geometry);
          setRouteDistanceMeters(r.distanceMeters);
          setRouteDurationSeconds(r.durationSeconds);
          
          if (partnerR) {
            setPartnerRouteGeometry(partnerR.geometry);
            setPartnerRouteDistanceMeters(partnerR.distanceMeters);
            setPartnerRouteDurationSeconds(partnerR.durationSeconds);
          } else {
            setPartnerRouteGeometry(null);
            setPartnerRouteDistanceMeters(null);
            setPartnerRouteDurationSeconds(null);
          }

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
              partnerRouteGeometry={partnerRouteGeometry}
              selectedId={selectedId}
              focusGeo={focusGeo}
              userGeo={liveUser}
              partnerLocation={nav.partnerLocation}
              followGeo={nav.userGeo}
              heading={nav.heading}
              userAvatar={userAvatar}
              partnerAvatar={partnerAvatar}
              traveled={nav.traveled}
              onSelect={setSelectedId}
              className="min-h-0 rounded-none border-0 shadow-none"
            />

            {/* ── Navigation HUD: distance + ETA + Speed ── */}
            <div
              className="absolute inset-x-0 top-0 flex items-center justify-center p-3"
              style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
            >
              <div className="flex flex-col items-center gap-2">
                {nav.isOffline && (
                  <div className="flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-xs font-medium text-white shadow-lg">
                    <WifiOff className="h-3.5 w-3.5" /> Mất kết nối mạng
                  </div>
                )}
                {isRecalculating.current && !nav.isOffline && (
                  <div className="flex items-center gap-2 rounded-full bg-yellow-500 px-3 py-1 text-xs font-medium text-white shadow-lg animate-in fade-in zoom-in">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tính lại đường...
                  </div>
                )}
                <div className="flex rounded-2xl bg-white/90 shadow-lg backdrop-blur-sm overflow-hidden divide-x divide-border">
                  {/* YOU */}
                  <div className="flex flex-col px-4 py-2 bg-blue-50/50">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Bạn</span>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Route className="h-3.5 w-3.5 text-blue-500" />
                        <span className="text-sm font-semibold">{fmtDistance(displayDistance)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-blue-500" />
                        <span className="text-sm font-semibold">{fmtDuration(displayDuration)}</span>
                      </div>
                    </div>
                  </div>

                  {/* PARTNER */}
                  {partnerRouteGeometry != null && (
                    <div className="flex flex-col px-4 py-2 bg-rose-50/50">
                      <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-1">Người ấy</span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Route className="h-3.5 w-3.5 text-rose-500" />
                          <span className="text-sm font-semibold">{fmtDistance(partnerRouteDistanceMeters)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-rose-500" />
                          <span className="text-sm font-semibold">{fmtDuration(partnerRouteDurationSeconds)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Floating Speed Indicator */}
            {nav.speedKmH != null && (
              <div 
                className="absolute right-4 top-1/2 flex -translate-y-1/2 flex-col items-center justify-center rounded-full border-[3px] border-accent bg-white/95 shadow-lg backdrop-blur-sm h-16 w-16"
              >
                <span className="text-xl font-bold leading-none tracking-tighter text-slate-800">{nav.speedKmH}</span>
                <span className="text-[9px] font-bold text-muted-foreground uppercase leading-none mt-0.5">km/h</span>
              </div>
            )}

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
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-[30px]">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-h1 font-serif">Bản đồ ăn chơi</h1>
        <div className="flex gap-2">
          <a
            href="/wheel"
            aria-label="Hôm nay ăn gì?"
            title="Hôm nay ăn gì?"
            className="border-border bg-card hover:bg-muted inline-flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm"
          >
            <Utensils className="h-4 w-4" />
          </a>
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
              partnerRouteGeometry={partnerRouteGeometry}
              selectedId={selectedId}
              focusGeo={focusGeo}
              userGeo={liveUser}
              partnerLocation={nav.partnerLocation}
              followGeo={nav.isNavigating ? nav.userGeo : null}
              heading={nav.isNavigating ? nav.heading : null}
              userAvatar={userAvatar}
              partnerAvatar={partnerAvatar}
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
            ) : hasTwoMembers ? (
              /* Space has 2 members — show choice */
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => {
                    setFocusGeo(null);
                    nav.start();
                  }}
                >
                  <UserRound className="h-4 w-4" /> Đi 1 mình
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={() => {
                    if (!selectedId) return;
                    const loc = list.data?.find((l) => l.id === selectedId);
                    if (loc) {
                      setCompanionLocationId(loc.id);
                      setCompanionLocationName(loc.name);
                      setShowCompanionChoice(true);
                    }
                  }}
                >
                  <Users className="h-4 w-4" /> Cùng khởi hành
                </Button>
              </div>
            ) : (
              <Button
                className="w-full gap-2"
                onClick={() => {
                  setFocusGeo(null);
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
            <EmptyState
              icon="map-pin"
              title="Chưa có địa điểm nào"
              subtitle="Bấm + Thêm để lưu chỗ hẹn hò đầu tiên."
              action={{ label: "+ Thêm địa điểm", onClick: () => { setFormInitial({}); setFormOpen(true); } }}
            />
          ) : (
            <StaggerList className="grid gap-3 sm:grid-cols-2">
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
            </StaggerList>
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

      {/* ── Companion choice confirmation modal ── */}
      <AnimatePresence>
        {showCompanionChoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setShowCompanionChoice(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                  <Users className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold">Cùng khởi hành</h3>
                  <p className="text-sm text-muted-foreground">Rủ người ấy cùng đi đến</p>
                </div>
              </div>
              <p className="text-center font-medium text-lg">{companionLocationName}</p>
              <p className="text-xs text-muted-foreground text-center">
                Người ấy sẽ nhận được thông báo mời. Khi đồng ý, cả 2 sẽ cùng mở bản đồ và thấy avatar của nhau trên đường đi.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowCompanionChoice(false)}>
                  Hủy
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={sendInvite.isPending}
                  onClick={() => {
                    if (companionLocationId) {
                      handleSendCompanionInvite(companionLocationId, companionLocationName);
                    }
                  }}
                >
                  {sendInvite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                  Gửi lời mời
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Waiting for partner to accept ── */}
      <AnimatePresence>
        {pendingSentInviteId && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="flex items-center gap-3 rounded-2xl bg-card px-5 py-3 shadow-xl border border-border">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              <span className="text-sm font-medium">Đang chờ người ấy đồng ý...</span>
              <button
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  cancelInvite.mutate({ inviteId: pendingSentInviteId });
                  setPendingSentInviteId(null);
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Incoming invite modal ── */}
      <AnimatePresence>
        {showIncomingInvite && navInvites.incomingInvite && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 20 }}
              className="bg-card rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4"
            >
              <div className="flex items-center justify-center">
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
                    <Users className="h-8 w-8 text-rose-500" />
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-5 w-5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-5 w-5 bg-rose-500" />
                  </span>
                </div>
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-semibold text-lg">Lời mời cùng đi!</h3>
                <p className="text-muted-foreground text-sm">
                  Người ấy rủ bạn cùng đi đến
                </p>
                <p className="font-bold text-accent text-lg">
                  {navInvites.incomingInvite.locationName}
                </p>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Cả 2 sẽ cùng mở bản đồ và thấy avatar của nhau trên đường đi nha 💕
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={respondInvite.isPending}
                  onClick={() =>
                    handleRespondToInvite(navInvites.incomingInvite!.id, false)
                  }
                >
                  Để sau
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={respondInvite.isPending}
                  onClick={() =>
                    handleRespondToInvite(navInvites.incomingInvite!.id, true)
                  }
                >
                  {respondInvite.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Cùng đi!
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
