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
  MapPinned,
  ChevronRight,
  ChevronLeft,
  Plus,
  Heart,
  MapPin,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerList } from "@/components/ui/stagger-list";
import { useLiveNavigation } from "./use-live-navigation";
import { useSearchParams } from "next/navigation";
import { LocationSettingsModal } from "./location-settings-modal";
import { CATEGORY_META } from "@/lib/category-meta";
import type { Category } from "@/lib/districts-categories";

// Shared styling for the small icon+label actions on a location card.
const ACTION_CLS =
  "inline-flex items-center gap-1 rounded-lg px-2 py-1 transition-colors";

// An intermediate stop in a companion trip plan (pickup + extra stops).
type PlannedStop =
  | { kind: "partner" }
  | { kind: "saved"; id: string; name: string; lat: number; lng: number };
import {
  appleMapsDirectionsUrl,
  googleMapsDirectionsUrl,
  prefersAppleMaps,
  calculateDistance,
  calculateMidpoint,
  type LatLng,
} from "@/lib/maps";
import { authClient } from "@/lib/auth-client";
import { LocationMapView } from "./location-mapview";
import { useNavigationInvitesContext } from "./navigation-invites-context";
import { acceptedTripStore, type AcceptedTrip } from "./accepted-trip-store";
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
  // Ordered intermediate stops between start (you) and the final destination.
  // "partner" resolves to the partner's live location at send time; "saved" is a
  // chosen saved place. Drives the numbered list in the companion modal and the
  // waypoints[] sent to the backend (which already splits the route into legs).
  const [plannedStops, setPlannedStops] = useState<PlannedStop[]>([]);
  const [stopPickerOpen, setStopPickerOpen] = useState(false);
  const [pendingSentInviteId, setPendingSentInviteId] = useState<string | null>(null);
  const [rejectedMessage, setRejectedMessage] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const sendInvite = trpc.location.sendNavInvite.useMutation();
  const cancelInvite = trpc.location.cancelNavInvite.useMutation();
  const pingLiveLocation = trpc.location.pingLiveLocation.useMutation();

  // ── "Meet Me Halfway" Feature ──
  const [isFindingMidpoint, setIsFindingMidpoint] = useState(false);
  const [midpointError, setMidpointError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [midpointRecommendations, setMidpointRecommendations] = useState<any[] | null>(null);
  const [showMidpointModal, setShowMidpointModal] = useState(false);
  const [midpointIndex, setMidpointIndex] = useState(0);

  // ── Weather ──
  const [weather, setWeather] = useState<{ temp: number; desc: string } | null>(null);

  // ── Traffic Warning ──
  const [showTrafficWarning, setShowTrafficWarning] = useState(false);
  const stationaryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Consume the single shared SSE connection (opened by NavigationInvitesProvider).
  const navInvites = useNavigationInvitesContext();
  // Track accepted trip from the store (populated by GlobalInviteListener when
  // either partner accepts an invite — carries waypoints for multi-leg routing).
  const [acceptedTrip, setAcceptedTrip] = useState<AcceptedTrip | null>(null);
  const [acceptedMessage, setAcceptedMessage] = useState<string | null>(null);
  // Destination id of the trip we already auto-started, so the effect fires
  // once per accepted trip even though the redirect URL keeps its loc/nav params.
  const autoStartedTripRef = useRef<string | null>(null);
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
  
  // Detect if partner is stuck
  useEffect(() => {
    const speed = nav.partnerLocation?.speedKmH;
    if (speed != null && speed < 3) {
      if (!stationaryTimeoutRef.current) {
        stationaryTimeoutRef.current = setTimeout(() => {
          setShowTrafficWarning(true);
          if (typeof navigator !== "undefined" && navigator.vibrate) {
             navigator.vibrate([200, 100, 200]);
          }
        }, 10_000); // 10 seconds for testing
      }
    } else {
      if (stationaryTimeoutRef.current) {
        clearTimeout(stationaryTimeoutRef.current);
        stationaryTimeoutRef.current = null;
      }
      setShowTrafficWarning(false);
    }
  }, [nav.partnerLocation?.speedKmH]);

  // Cleanup timeout ONLY on unmount to prevent resetting on minor speed fluctuations (e.g. 0 -> 2 -> 0)
  useEffect(() => {
    return () => {
      if (stationaryTimeoutRef.current) clearTimeout(stationaryTimeoutRef.current);
    };
  }, []);
  const { data: session } = authClient.useSession();
  const members = trpc.space.members.useQuery();
  
  const userAvatar = session?.user.image || undefined;
  const partnerAvatar = members.data?.find((m) => m.id !== session?.user.id)?.image || undefined;
  const hasTwoMembers = (members.data?.length ?? 0) >= 2;

  // Fetch weather when destination is selected
  useEffect(() => {
    if (selectedId && list.data) {
      const loc = list.data.find(l => l.id === selectedId);
      if (loc?.geo) {
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.geo.lat}&longitude=${loc.geo.lng}&current=temperature_2m,weather_code`)
          .then(res => res.json())
          .then(data => {
            if (data?.current) {
               const code = data.current.weather_code;
               let desc = "Trời quang";
               if (code >= 50 && code <= 69) desc = "Mưa rào nhẹ";
               if (code >= 80 && code <= 99) desc = "Mưa to rào";
               if (code >= 1 && code <= 3) desc = "Nhiều mây";
               setWeather({ temp: data.current.temperature_2m, desc });
            }
          })
          .catch(() => {});
      }
    } else {
      setWeather(null);
    }
  }, [selectedId, list.data]);

  // Auto-fetch partner route when their live location connects and we don't have their route yet
  useEffect(() => {
    if (selectedId && nav.partnerLocation && !partnerRouteGeometry && !isRecalculating.current) {
      utils.location.getRoute.fetch({
        destinationId: selectedId,
        origin: { lat: nav.partnerLocation.lat, lng: nav.partnerLocation.lng }
      }).then(r => {
        setPartnerRouteGeometry(r.geometry);
        setPartnerRouteDistanceMeters(r.distanceMeters);
        setPartnerRouteDurationSeconds(r.durationSeconds);
      }).catch(() => {
        // ignore
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, nav.partnerLocation?.lat, nav.partnerLocation?.lng, partnerRouteGeometry, utils.location]);

  // Subscribe to the accepted-trip store so we react when GlobalInviteListener
  // writes a new accepted trip (either sender or receiver path).
  useEffect(() => {
    // Sync initial value (in case store was set before this component mounted).
    setAcceptedTrip(acceptedTripStore.get());
    return acceptedTripStore.subscribe((t) => {
      // Re-arm the one-shot guard whenever a genuinely new trip arrives so the
      // same destination can be re-invited later.
      if (t) autoStartedTripRef.current = null;
      setAcceptedTrip(t);
    });
  }, []);

  // Auto-start navigation when an accepted trip lands — triggered either by the
  // URL params (redirect from GlobalInviteListener) or by the store update
  // (already on /map when partner accepts). The old guard `!selectedId` blocked
  // this when a pin was already selected, requiring a reload to clear it.
  useEffect(() => {
    const locId = searchParams.get('loc') ?? acceptedTrip?.locationId ?? null;
    const startNav = searchParams.get('nav');
    const fromStore = acceptedTrip != null;

    // Trigger when: URL has nav=1 param, OR the store just received an accepted trip.
    const shouldStart = (locId && startNav === "1") || fromStore;
    if (!shouldStart || !list.data || !locId) return;

    // One-shot per accepted trip: the redirect URL keeps carrying loc&nav after
    // we consume the store, so without this guard the effect re-runs and fires a
    // second geolocation prompt + getRoute (last-writer-wins race on the route).
    if (autoStartedTripRef.current === locId) return;
    autoStartedTripRef.current = locId;

    const tripWaypoints = acceptedTrip?.waypoints ?? [];
    // Clear the store regardless of whether the pin resolves, so a deleted /
    // missing pin can't leave a stale accepted trip stuck forever.
    acceptedTripStore.set(null);

    const loc = list.data.find(l => l.id === locId);
    if (!loc?.geo) return;

    // Convert invite Waypoint[] to the {lat,lng}[] shape getRoute expects.
    const waypointGeos = tripWaypoints.map(w => ({ lat: w.lat, lng: w.lng }));

    goToLocation(loc.id, loc.geo, waypointGeos);
    setPendingSentInviteId(null);
    // Friendly notice tailored to each side: the sender hears their invite was
    // accepted; the receiver (who just tapped "Đi liền") gets a go-together nudge.
    if (fromStore) {
      setAcceptedMessage(
        acceptedTrip?.role === "receiver"
          ? "Cùng xuất phát nào 🛵"
          : "Yayy! Người ấy đồng ý rồi, mình xuất phát thôi 💞",
      );
      setTimeout(() => setAcceptedMessage(null), 4000);
    }
    setTimeout(() => {
      setFocusGeo(null);
      nav.start();
    }, 2000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, list.data, acceptedTrip]);

  // Listen for invite rejection from GlobalInviteListener
  useEffect(() => {
    const handleRejected = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.id === pendingSentInviteId) {
        setPendingSentInviteId(null);
        setRejectedMessage("Hí, người ấy bận xíu hoặc lỡ tay rồi — rủ lại sau nha 🥺");
        setTimeout(() => setRejectedMessage(null), 4000);
      }
    };
    window.addEventListener("invite-rejected", handleRejected);
    return () => window.removeEventListener("invite-rejected", handleRejected);
  }, [pendingSentInviteId]);
  // Cùng khởi hành: Target a specific saved location to navigate together.
  const handleSendCompanionInvite = (destId: string, destName: string) => {
    // Build the ordered waypoints from the planned stops. A "partner" stop
    // resolves to the partner's live location now; if it's unavailable we drop
    // that stop rather than send a coordinate-less waypoint.
    type InviteWaypoint = {
      lat: number;
      lng: number;
      name: string;
      type: "partner_location" | "saved_place" | "custom";
      status: "pending" | "arrived";
    };
    const waypoints = plannedStops.flatMap((s): InviteWaypoint[] => {
      if (s.kind === "partner") {
        if (!nav.partnerLocation) return [];
        return [{
          lat: nav.partnerLocation.lat,
          lng: nav.partnerLocation.lng,
          name: "Vị trí của người ấy",
          type: "partner_location",
          status: "pending",
        }];
      }
      return [{
        lat: s.lat,
        lng: s.lng,
        name: s.name,
        type: "saved_place",
        status: "pending",
      }];
    });

    sendInvite.mutate(
      { locationId: destId, locationName: destName, waypoints: waypoints.length ? waypoints : undefined },
      {
        onSuccess: (res) => {
          setPendingSentInviteId(res.id);
          setShowCompanionChoice(false);
          setCompanionLocationId(null);
          setPlannedStops([]);
          setStopPickerOpen(false);
        },
      },
    );
  };

  // In-app "Chỉ đường": select the pin, fly to it, then get the user's location
  // and draw the route. Errors surface to the user instead of failing silently.
  // waypoints: optional intermediate stops from an accepted companion trip — passed
  // straight through to getRoute so the multi-leg route is drawn correctly.
  function goToLocation(
    id: string,
    dest: LatLng | null,
    waypoints?: Array<{ lat: number; lng: number }>,
  ) {
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
          // Pass waypoints to getRoute so multi-stop companion trips draw correctly.
          const routeArgs = {
            destinationId: id,
            origin,
            ...(waypoints && waypoints.length > 0 ? { waypoints } : {}),
          };
          const reqs = [utils.location.getRoute.fetch(routeArgs)];

          // If partner is currently active, fetch a route for them too
          if (nav.partnerLocation) {
            reqs.push(utils.location.getRoute.fetch({
              destinationId: id,
              origin: { lat: nav.partnerLocation.lat, lng: nav.partnerLocation.lng },
              ...(waypoints && waypoints.length > 0 ? { waypoints } : {}),
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

  // ── Logic for Meet Me Halfway ──
  const partnerLocationRef = useRef(nav.partnerLocation);
  partnerLocationRef.current = nav.partnerLocation;

  const handleFindMidpoint = useCallback(() => {
    setIsFindingMidpoint(true);
    setMidpointError(null);

    if (!navigator.geolocation) {
      setMidpointError("Trình duyệt không hỗ trợ định vị.");
      setIsFindingMidpoint(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserGeo(origin);

        try {
          // Priority 1: Use the last known partner location from SSE/polling
          let partnerGeo: LatLng | null = null;
          const cached = partnerLocationRef.current;
          if (cached && cached.lat && cached.lng) {
            partnerGeo = { lat: cached.lat, lng: cached.lng };
          } else {
            // Priority 2: Ping API to try to get partner
            const partners = await pingLiveLocation.mutateAsync(origin);
            const partner = partners[0];
            if (partner && partner.lat && partner.lng) {
              partnerGeo = { lat: partner.lat, lng: partner.lng };
            }
          }

          if (!partnerGeo) {
            setMidpointError("Người ấy chưa mở trang Bản đồ gần đây nên mình chưa biết vị trí của họ. Nhờ người ấy vào trang Bản đồ trước nhé! 💕");
            setIsFindingMidpoint(false);
            return;
          }

          // Calculate midpoint
          const midpoint = calculateMidpoint(origin, partnerGeo);

          // Find the 3 closest locations from our saved pins to the midpoint
          const validPins = (list.data ?? [])
            .filter((p) => p.geo)
            .map((p) => ({
              ...p,
              distanceToMidpoint: calculateDistance(midpoint, p.geo!),
            }))
            .sort((a, b) => a.distanceToMidpoint - b.distanceToMidpoint)
            .slice(0, 3); // top 3

          if (validPins.length === 0) {
            setMidpointError("Chưa có địa điểm nào được lưu có toạ độ. Hãy thêm địa điểm và gắn link Google Maps trước nhé!");
            setIsFindingMidpoint(false);
            return;
          }

          setMidpointRecommendations(validPins);
          setMidpointIndex(0);
          setShowMidpointModal(true);
          setIsFindingMidpoint(false);
        } catch {
          setMidpointError("Lỗi kết nối mạng khi tìm vị trí người ấy. Hãy thử lại.");
          setIsFindingMidpoint(false);
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setMidpointError("Trình duyệt chưa cấp quyền GPS — hãy cho phép rồi thử lại.");
        } else {
          setMidpointError("Không lấy được vị trí hiện tại — hãy bật GPS rồi bấm lại.");
        }
        setIsFindingMidpoint(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, [pingLiveLocation, list.data]);

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
                <div className="flex rounded-2xl bg-white/90 shadow-lg backdrop-blur-sm overflow-hidden divide-x divide-border">
                  {/* YOU */}
                  <div className="flex flex-col px-3 py-2 sm:px-4 bg-blue-50/50 relative flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1 pr-1">
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider truncate">Bạn</span>
                      {weather && (
                        <div className="text-[10px] font-medium text-blue-800/60 bg-blue-100/50 px-1.5 rounded-full flex items-center gap-1 shrink-0 whitespace-nowrap">
                          ⛅ {weather.temp}°C
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-3 mt-0.5">
                      <div className="flex items-center gap-1">
                        <Route className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-500 shrink-0" />
                        <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">{fmtDistance(displayDistance)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-500 shrink-0" />
                        <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">{fmtDuration(displayDuration)}</span>
                      </div>
                    </div>
                  </div>

                  {/* PARTNER */}
                  {partnerRouteGeometry != null && (
                    <div className="flex flex-col px-3 py-2 sm:px-4 bg-rose-50/50 relative flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1 pr-1">
                        <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider truncate">
                          Người ấy
                          {nav.partnerLocation?.speedKmH != null && (
                            <span className="ml-1 sm:ml-2 font-normal opacity-90 lowercase text-[9px] sm:text-xs">
                              {nav.partnerLocation.speedKmH < 4 ? "🛑 Đứng im lìm" : 
                               nav.partnerLocation.speedKmH > 15 ? "🏍️ Vù vù" : "🛵 Tàng tàng"}
                            </span>
                          )}
                        </span>
                        {nav.partnerLocation?.batteryLevel != null && (
                          <div className={`text-[10px] font-medium px-1.5 rounded-full flex items-center gap-1 shrink-0 whitespace-nowrap ${
                            nav.partnerLocation.batteryLevel < 20 ? "text-red-700 bg-red-100/80 animate-pulse border border-red-300" : "text-rose-800/60 bg-rose-100/50"
                          }`}>
                            {nav.partnerLocation.batteryLevel < 20 ? "🪫" : "🔋"} {nav.partnerLocation.batteryLevel}% {nav.partnerLocation.batteryLevel < 20 && "Cấp cứu!"}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-3 mt-0.5">
                        <div className="flex items-center gap-1">
                          <Route className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-rose-500 shrink-0" />
                          <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">{fmtDistance(partnerRouteDistanceMeters)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-rose-500 shrink-0" />
                          <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">{fmtDuration(partnerRouteDurationSeconds)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ETA GAP Analysis */}
                {displayDuration != null && partnerRouteDurationSeconds != null && (
                  <div className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-md">
                    {displayDuration - partnerRouteDurationSeconds > 120 ? (
                      <span>Ối, bạn sẽ đến trễ hơn <strong className="text-rose-500">{Math.round((displayDuration - partnerRouteDurationSeconds)/60)} phút</strong>. Lo chạy lẹ lên 🏃‍♂️💨</span>
                    ) : partnerRouteDurationSeconds - displayDuration > 120 ? (
                      <span>Bạn đến sớm hơn <strong className="text-blue-500">{Math.round((partnerRouteDurationSeconds - displayDuration)/60)} phút</strong>. Tha hồ order nước ngồi chờ 🍹</span>
                    ) : (
                      <span className="text-emerald-600">Perfect timing! Hai bạn sẽ cập bến cùng lúc 🎯</span>
                    )}
                  </div>
                )}

                {/* Traffic Warning Banner */}
                {showTrafficWarning && (
                  <div className="bg-rose-500 text-white shadow-xl rounded-full px-5 py-2.5 flex items-center gap-2 text-sm font-bold border-2 border-white/20 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-500">
                    <span className="animate-bounce">🛑</span> Người ấy đang dừng xe hoặc kẹt cứng rồi!
                  </div>
                )}
              </div>
            </div>

            {/* Floating Speed Indicator */}
            {nav.speedKmH != null && (
              <div 
                className="absolute right-4 top-[40%] flex flex-col items-center justify-center rounded-full border-[3px] border-accent bg-white/95 shadow-lg backdrop-blur-sm h-16 w-16"
              >
                <span className="text-xl font-bold leading-none tracking-tighter text-slate-800">{nav.speedKmH}</span>
                <span className="text-[9px] font-bold text-muted-foreground uppercase leading-none mt-0.5">km/h</span>
              </div>
            )}

            {/* Quick Pings */}
            <div className="absolute right-4 top-[60%] flex flex-col items-center gap-2">
               <button onClick={() => nav.sendPingAction?.("HOT")} className="h-10 w-10 bg-white/90 rounded-full shadow-md hover:bg-muted flex items-center justify-center text-lg transition-transform active:scale-90">🥵</button>
               <button onClick={() => nav.sendPingAction?.("JAM")} className="h-10 w-10 bg-white/90 rounded-full shadow-md hover:bg-muted flex items-center justify-center text-lg transition-transform active:scale-90">🐌</button>
               <button onClick={() => nav.sendPingAction?.("WAIT")} className="h-10 w-10 bg-white/90 rounded-full shadow-md hover:bg-muted flex items-center justify-center text-lg transition-transform active:scale-90">🥺</button>
               <button onClick={() => nav.sendPingAction?.("HURRY")} className="h-10 w-10 bg-white/90 rounded-full shadow-md hover:bg-muted flex items-center justify-center text-lg transition-transform active:scale-90 border-2 border-rose-400">🚨</button>
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
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-[30px]">
      {/* Action bar stays pinned; only the cards below scroll under it. */}
      <div className="sticky top-0 z-30 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-sm md:-mx-[30px] md:px-[30px]">
        <h1 className="text-3xl sm:text-h1 font-serif">Bản đồ ăn chơi</h1>
        <div className="flex gap-2">
          {hasTwoMembers && (
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-all",
                isFindingMidpoint && "opacity-50 pointer-events-none"
              )}
              onClick={handleFindMidpoint}
              title="Tìm điểm hẹn ở giữa"
            >
              {isFindingMidpoint ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPinned className="h-4 w-4" />
              )}
            </Button>
          )}
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
        <div className="contents lg:block lg:sticky lg:top-[84px] lg:self-start lg:space-y-3">
          <div className="order-1 grid grid-cols-2 md:grid-cols-3 gap-2 lg:order-none">
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
              className="col-span-2 md:col-span-1"
              options={[
                { value: "", label: "Tất cả" },
                { value: "want_to_go", label: "Muốn đi" },
                { value: "visited", label: "Đã đi" },
              ]}
            />
          </div>

          <div className="order-3 space-y-3 lg:order-none pb-28 md:pb-0">
            <div id="map-view" className="h-72 lg:h-[calc(100dvh-13rem)]">
            <LocationMapView
              pins={pins}
              routeGeometry={routeGeometry}
              partnerRouteGeometry={partnerRouteGeometry}
              selectedId={selectedId}
              focusGeo={focusGeo}
              userGeo={liveUser}
              partnerLocation={nav.partnerLocation}
              partnerPingAction={navInvites.partnerPingAction}
              userPingAction={nav.userPingAction}
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
          <div className="flex flex-col gap-2">
            {nav.isOffline && (
              <div className="flex self-center items-center gap-2 rounded-full bg-red-500 px-3 py-1.5 text-xs font-medium text-white shadow-md mb-1 animate-in fade-in slide-in-from-bottom-2">
                <WifiOff className="h-3.5 w-3.5" /> Mất kết nối mạng
              </div>
            )}
            {isRecalculating.current && !nav.isOffline && (
              <div className="flex self-center items-center gap-2 rounded-full bg-yellow-500 px-3 py-1.5 text-xs font-medium text-white shadow-md mb-1 animate-in fade-in slide-in-from-bottom-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tính lại đường...
              </div>
            )}
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
          </div>
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
                          <p className="flex-1 font-medium leading-tight">{l.name}</p>
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

      {/* ── Midpoint Error Toast ── */}
      <AnimatePresence>
        {midpointError && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-20 md:bottom-6 left-1/2 z-[70] w-[92%] max-w-sm -translate-x-1/2"
          >
            <div className="flex items-start gap-3 rounded-2xl bg-card px-5 py-4 shadow-2xl border border-border ring-1 ring-rose-100">
              <span className="text-xl shrink-0 mt-0.5">📍</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug">{midpointError}</p>
              </div>
              <button
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0 p-1"
                onClick={() => setMidpointError(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Meet Me Halfway Modal ── */}
      <AnimatePresence>
        {showMidpointModal && midpointRecommendations && midpointRecommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
            onClick={() => setShowMidpointModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              className="bg-card w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-rose-400 to-pink-500 p-6 text-white text-center relative">
                <button 
                  onClick={() => setShowMidpointModal(false)}
                  className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 shadow-inner backdrop-blur-sm">
                  <MapPinned className="h-8 w-8" />
                </div>
                <h3 className="font-serif text-2xl font-bold">Gặp Nhau Ở Giữa 📍</h3>
                <p className="mt-1 text-sm text-rose-50 opacity-90">
                  Đây là các địa điểm đã lưu nằm ngay giữa quãng đường của hai bạn!
                </p>
              </div>

              {/* Carousel Body */}
              <div className="p-6 relative">
                {midpointRecommendations.length > 1 && (
                  <>
                    <button
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 flex items-center justify-center rounded-full bg-background shadow hover:bg-muted"
                      onClick={() => setMidpointIndex((i) => (i === 0 ? midpointRecommendations.length - 1 : i - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 flex items-center justify-center rounded-full bg-background shadow hover:bg-muted"
                      onClick={() => setMidpointIndex((i) => (i + 1) % midpointRecommendations.length)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}

                <AnimatePresence mode="wait">
                  <motion.div
                    key={midpointIndex}
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col items-center text-center space-y-4 px-6"
                  >
                    <div className="bg-accent/10 text-accent rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                      Gợi ý #{midpointIndex + 1}
                    </div>
                    <h4 className="text-xl font-bold leading-tight">{midpointRecommendations[midpointIndex].name}</h4>
                    
                    <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Navigation className="h-3.5 w-3.5" /> 
                        Cách trung điểm {(midpointRecommendations[midpointIndex].distanceToMidpoint / 1000).toFixed(1)} km
                      </span>
                      <span>·</span>
                      <span>{midpointRecommendations[midpointIndex].district}</span>
                      <span>·</span>
                      <span>{midpointRecommendations[midpointIndex].category}</span>
                    </div>

                    <Button
                      className="w-full mt-4 gap-2 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 shadow-md text-white border-none"
                      disabled={sendInvite.isPending}
                      onClick={() => {
                        const loc = midpointRecommendations[midpointIndex];
                        handleSendCompanionInvite(loc.id, loc.name);
                        setShowMidpointModal(false);
                      }}
                    >
                      {sendInvite.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Users className="h-5 w-5" />}
                      Rủ người ấy tới đây!
                    </Button>
                  </motion.div>
                </AnimatePresence>
                
                {/* Carousel Dots */}
                {midpointRecommendations.length > 1 && (
                  <div className="mt-6 flex justify-center gap-1.5">
                    {midpointRecommendations.map((_, i) => (
                      <button
                        key={i}
                        className={cn("h-1.5 rounded-full transition-all duration-300", i === midpointIndex ? "w-6 bg-rose-400" : "w-1.5 bg-muted-foreground/30")}
                        onClick={() => setMidpointIndex(i)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Companion choice confirmation modal ── */}
      <AnimatePresence>
        {showCompanionChoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => { setShowCompanionChoice(false); setPlannedStops([]); setStopPickerOpen(false); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 shrink-0 shadow-inner">
                    <Users className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg leading-tight">Lập kế hoạch đi chung</h3>
                    <p className="text-sm text-muted-foreground">Tạo lộ trình cho 2 người</p>
                  </div>
                </div>
                
                <div className="space-y-3 bg-muted/30 p-4 rounded-xl border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                    <span className="text-sm font-medium">Bạn xuất phát từ đây</span>
                  </div>
                  
                  {/* Intermediate stops (pickup + extra stops), numbered 2..N. */}
                  {plannedStops.map((s, i) => {
                    const isPartner = s.kind === "partner";
                    return (
                      <div key={isPartner ? "partner" : s.id} className="pl-3 border-l-2 border-rose-200 ml-3 py-1">
                        <div className="flex items-center justify-between p-3 bg-rose-50 text-rose-700 rounded-lg shadow-sm border border-rose-100 relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-6 w-6 rounded-full bg-rose-200 text-rose-700 flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">{i + 2}</div>
                            <div className="min-w-0">
                              <span className="text-sm font-medium block truncate">{isPartner ? "Ghé đón người ấy" : s.name}</span>
                              <span className="text-[11px] text-rose-500/80 block">{isPartner ? "Vị trí trực tiếp" : "Điểm dừng"}</span>
                            </div>
                          </div>
                          <button onClick={() => setPlannedStops((arr) => arr.filter((_, j) => j !== i))} className="p-1 hover:bg-rose-200 rounded-full transition-colors shrink-0"><X className="h-4 w-4" /></button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add-stop control with an inline saved-place / partner picker. */}
                  {(() => {
                    const hasPartnerStop = plannedStops.some((s) => s.kind === "partner");
                    const usedSavedIds = new Set(
                      plannedStops.filter((s): s is Extract<PlannedStop, { kind: "saved" }> => s.kind === "saved").map((s) => s.id),
                    );
                    const savedOptions = (list.data ?? []).filter(
                      (l) => l.geo && l.id !== companionLocationId && !usedSavedIds.has(l.id),
                    );
                    const canAddPartner = !!nav.partnerLocation && !hasPartnerStop;
                    if (!stopPickerOpen) {
                      return (
                        <div className="pl-3 border-l-2 border-dashed border-muted-foreground/30 ml-3 py-1">
                          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground border border-dashed bg-background/50" onClick={() => setStopPickerOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" /> {plannedStops.length === 0 ? "Ghé đón người ấy / thêm điểm dừng" : "Thêm điểm dừng"}
                          </Button>
                        </div>
                      );
                    }
                    return (
                      <div className="pl-3 border-l-2 border-rose-200 ml-3 py-1 space-y-1.5">
                        <div className="rounded-lg border border-border bg-background p-2 space-y-1 max-h-44 overflow-y-auto">
                          {canAddPartner && (
                            <button
                              onClick={() => { setPlannedStops((a) => [...a, { kind: "partner" }]); setStopPickerOpen(false); }}
                              className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-rose-50 transition-colors"
                            >
                              <Heart className="h-4 w-4 text-rose-500 shrink-0" />
                              <span className="font-medium">Vị trí trực tiếp của người ấy</span>
                            </button>
                          )}
                          {savedOptions.map((l) => (
                            <button
                              key={l.id}
                              onClick={() => { setPlannedStops((a) => [...a, { kind: "saved", id: l.id, name: l.name, lat: l.geo!.lat, lng: l.geo!.lng }]); setStopPickerOpen(false); }}
                              className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-muted transition-colors"
                            >
                              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="truncate">{l.name}</span>
                            </button>
                          ))}
                          {!canAddPartner && savedOptions.length === 0 && (
                            <p className="text-muted-foreground text-xs p-2">Không còn địa điểm nào để thêm.</p>
                          )}
                        </div>
                        <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setStopPickerOpen(false)}>Đóng</Button>
                      </div>
                    );
                  })()}

                  {/* Final destination, numbered after all stops. */}
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {plannedStops.length + 2}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-muted-foreground block text-xs">Đích đến cuối cùng</span>
                      <span className="text-sm font-semibold truncate block">{companionLocationName}</span>
                    </div>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground text-center">
                  Người ấy sẽ nhận được thông báo lộ trình. Khi đồng ý, cả 2 sẽ cùng thấy nhau trên bản đồ.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setShowCompanionChoice(false); setPlannedStops([]); setStopPickerOpen(false); }}>
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
            className="fixed bottom-6 left-1/2 z-50 w-[90%] max-w-sm -translate-x-1/2"
          >
            <div className="flex items-center gap-3 rounded-2xl bg-card px-5 py-3 shadow-xl border border-border">
              <Loader2 className="h-5 w-5 animate-spin text-accent shrink-0" />
              <span className="text-sm font-medium flex-1">Đang chờ người ấy đồng ý...</span>
              <button
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0 p-1"
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

        {/* ── Rejected message ── */}
        {rejectedMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 z-50 w-[90%] max-w-sm -translate-x-1/2"
          >
            <div className="flex items-center gap-3 rounded-2xl bg-rose-50 text-rose-600 px-5 py-3 shadow-xl border border-rose-200">
              <span className="shrink-0 text-lg">💔</span>
              <span className="text-sm font-medium">{rejectedMessage}</span>
            </div>
          </motion.div>
        )}

        {/* ── Accepted message (sender sees this when partner says yes) ── */}
        {acceptedMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 z-50 w-[90%] max-w-sm -translate-x-1/2"
          >
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 text-emerald-700 px-5 py-3 shadow-xl border border-emerald-200">
              <span className="shrink-0 text-lg">💞</span>
              <span className="text-sm font-medium">{acceptedMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
