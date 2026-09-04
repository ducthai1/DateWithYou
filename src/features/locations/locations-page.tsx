"use client";

import dynamic from "next/dynamic";
import { readableFormError } from "@/lib/form-error";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSidebar } from "@/components/layout/sidebar-context";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { List as ListIcon, Volume2, VolumeX, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle, Clock, ExternalLink, Link2, Loader2, LocateOff, MapPinned, Navigation, PanelLeftClose, PanelLeftOpen, Pause, PictureInPicture2, Pencil, Play, Route, Satellite, Settings, Square, Trash2, UserRound, Users, Utensils, WifiOff, X } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerList } from "@/components/ui/stagger-list";
import { type LegInfo } from "./use-live-navigation";
import { useTurnByTurn } from "./use-turn-by-turn";
import { useNavMiniWindow } from "./use-nav-mini-window";
import type { MiniNavFrame } from "./nav-mini-canvas";
import { ManeuverArrowIcon } from "./maneuver-arrow-icon";
import { maneuverArrow, maneuverLabel, fmtMetresVi } from "@/lib/maneuver-vi";
import { isVoiceEnabled, setVoiceEnabled, speak } from "@/lib/speak";
import { departureSentence } from "@/lib/departure-voice";
import { rerouteLine } from "@/lib/nav-chatter";
import { destinationSide } from "@/lib/route-geometry";
import { releaseAudio, unlockAudio } from "@/lib/audio-session";
import { useNavigation } from "./navigation-context";
import { fmtDistance, fmtDuration } from "./format-journey";
import { ToneArt } from "@/components/theme/tone-art";
import { Modal, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { TripStopPlanner, type PlannedStop } from "./trip-stop-planner";
import { LocationSettingsModal } from "./location-settings-modal";
import { CATEGORY_META } from "@/lib/category-meta";
import type { Category } from "@/lib/districts-categories";

// Shared styling for the small icon+label actions on a location card. Padding +
// min-height give a ≥40px touch target on mobile (was px-2 py-1 ≈ 22px tall);
// touch-manipulation removes the 300ms tap delay and active: gives tap feedback.
const ACTION_CLS =
  "inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 py-2 transition-colors touch-manipulation active:scale-95";

// An intermediate stop in a companion trip plan (pickup + extra stops).
import {
  appleMapsDirectionsUrl,
  googleMapsDirectionsUrl,
  prefersAppleMaps,
  calculateDistance,
  calculateMidpoint,
  isPartnerFixFresh,
  isOpenAt,
  type LatLng,
} from "@/lib/maps";
import { authClient } from "@/lib/auth-client";

// Within this many metres of a leg's end point we treat the leg as reached and
// prompt to start the next one. Loose enough to fire despite GPS jitter.
const LEG_ARRIVE_THRESHOLD_M = 40;

// The end point of a leg is the last coordinate of its polyline ([lng,lat]).
function legEndpoint(leg: LegInfo): LatLng {
  const c = leg.geometry.coordinates;
  const last = c[c.length - 1];
  return { lat: last[1], lng: last[0] };
}

// A companion invite stays "accepted" on the server, so on reload the SSE/poll
// re-delivers it and the trip would auto-start again. Persisting the invite ids
// the user has explicitly ended lets us ignore that re-delivery after an end.
const ENDED_TRIPS_KEY = "dwy:endedTripInvites";
function markTripEnded(inviteId: string): void {
  try {
    const raw = localStorage.getItem(ENDED_TRIPS_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    if (!arr.includes(inviteId)) arr.push(inviteId);
    localStorage.setItem(ENDED_TRIPS_KEY, JSON.stringify(arr.slice(-20)));
  } catch {
    /* localStorage unavailable (private mode) — best effort only */
  }
}
function isTripEnded(inviteId: string): boolean {
  try {
    const raw = localStorage.getItem(ENDED_TRIPS_KEY);
    return raw ? (JSON.parse(raw) as string[]).includes(inviteId) : false;
  } catch {
    return false;
  }
}

// Split out of this page's chunk on purpose. Measured on a throttled phone
// profile, maplibre is a 267 KB chunk that this page had to finish downloading
// before it could render anything at all — so the whole screen sat on "Đang tải
// bản đồ…" even though the search box, the location list and the panel need
// none of it. Loading the canvas separately lets that UI paint as soon as the
// 24 KB page chunk lands; the map fills in behind it (it renders at
// `fixed inset-0 z-0`, underneath the panel) once its own chunk arrives.
// No ref is ever taken on this component, so the dynamic() wrapper is transparent.
const LocationMapView = dynamic(
  () => import("./location-mapview").then((m) => m.LocationMapView),
  {
    ssr: false,
    loading: () => <div className="bg-muted/40 absolute inset-0" />,
  },
);
import { useNavigationInvitesContext } from "./navigation-invites-context";
import { usePartner } from "@/features/space/use-partner";
import { acceptedTripStore, type AcceptedTrip } from "./accepted-trip-store";
import { LocationForm, type LocationFormValues } from "./location-form";
import { useToast } from "@/components/ui/toast";
import { MeetingFlare } from "./meeting-flare";
import { MapSheet } from "./map-sheet";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { PlaceSearchBox } from "./place-search-box";
import { buzz } from "@/lib/haptics";


/**
 * The four emotions that can be sent mid-journey.
 *
 * A table rather than four near-identical elements: they only ever differed by
 * glyph and label, and the copies had already drifted apart in their classes.
 */
const PING_BUTTONS: Array<{ action: string; emoji: string; label: string; urgent?: boolean }> = [
  { action: "HOT", emoji: "🥵", label: "Nóng quá!" },
  { action: "JAM", emoji: "🐌", label: "Kẹt xe!" },
  { action: "WAIT", emoji: "🥺", label: "Đợi xíu nha" },
  { action: "HURRY", emoji: "🚨", label: "Nhanh lên!", urgent: true },
];

export function LocationsPage() {
  const toast = useToast();
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

  // ── Multi-leg trip navigation ──
  // When a companion trip has intermediate stops, the route is split into legs
  // (4 points → 3 legs). All legs are drawn up-front in distinct colours; only
  // `currentLegIndex` is "live" (its distance/off-route/arrival are tracked).
  // Re-routing only ever touches the active leg, so upcoming legs stay put.
  const [legGeometries, setLegGeometries] = useState<LegInfo[] | null>(null);
  const [currentLegIndex, setCurrentLegIndex] = useState(0);
  // True once the active leg's end point is reached, gating the "next leg" prompt.
  const [legArrived, setLegArrived] = useState(false);
  // Arming guard: a leg can only register "arrived" after the rider has first
  // been clearly en route (remaining > threshold). Without this, the stale
  // small `remainingMeters` carried over from the previous leg would instantly
  // re-trigger arrival the moment we advance.
  const legArmedRef = useRef(false);
  // Transient banner shown when a leg starts/completes ("Bắt đầu chặng 2", …).
  const [legMessage, setLegMessage] = useState<string | null>(null);
  // A trip is "paused" when the user temporarily exits the full-screen nav but
  // hasn't ended it — the route stays drawn and Resume/End show under the map.
  const [pausedTrip, setPausedTrip] = useState(false);
  // Invite id backing the current companion trip, so End can mark it ended and
  // stop the server-side re-delivery from auto-starting it again on reload.
  const [currentTripInviteId, setCurrentTripInviteId] = useState<string | null>(null);

  /*
   * Whether THIS ride is one both people agreed to travel together on.
   *
   * The app used to infer it from "the other person has a live location",
   * which is not the same question and is true far more often: a live location
   * exists whenever they have opened the map in the last few minutes. So a solo
   * ride, taken while the other person happened to be looking at their phone,
   * drew their route to YOUR destination, turned the HUD into the two-column
   * companion layout, announced "người kia cũng đang trên đường rồi", and put
   * up "người kia đang dừng xe" when they sat still — none of which they had
   * agreed to or even knew about.
   *
   * The invite is the agreement, so the invite is the signal. It is cleared by
   * goToLocation for a manual trip and set again only by the accepted-invite
   * handler.
   */
  const isCompanionTrip = currentTripInviteId != null;
  // Controls the "are you sure you want to end?" confirmation modal.
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // ── Companion navigation ("Cùng khởi hành") ──
  /*
   * On a phone the start-of-trip choice is a dialog, not a row of buttons.
   *
   * "Chỉ đường" is pressed from a card inside the sheet, so the sheet is raised
   * when the route finishes drawing — and the controls that offer "Đi 1 mình"
   * and "Cùng khởi hành" live in the map column at z-30, under the sheet at
   * z-45. The choice appeared and was covered in the same frame, so the button
   * read as doing nothing at all. Raising those controls above the sheet would
   * only trade one covered thing for another; asking in a dialog answers the
   * question where nothing can sit on top of it.
   */
  const [tripChoiceOpen, setTripChoiceOpen] = useState(false);
  /** Bumped to drop the sheet so the freshly drawn route is visible behind the dialog. */
  const [sheetCollapseTick, setSheetCollapseTick] = useState(0);
  /*
   * Bumped after a place is saved, to lift the sheet off its lowest stop.
   *
   * Collapsed, the sheet shows a card's name and status and then runs out of
   * room — measured on a 390x844 screen, the row of actions underneath
   * ("Chỉ đường" among them) lands at y=822 inside a box that ends at 768. So
   * saving a place and then finding no way to navigate to it was the honest
   * reading of what was on screen. The list is newest-first, so lifting the
   * sheet puts the place just added, whole, at the top.
   */
  const [sheetExpandTick, setSheetExpandTick] = useState(0);
  const [showCompanionChoice, setShowCompanionChoice] = useState(false);
  const [companionLocationId, setCompanionLocationId] = useState<string | null>(null);
  const [companionLocationName, setCompanionLocationName] = useState("");
  // Ordered intermediate stops between start (you) and the final destination.
  // "partner" resolves to the partner's live location at send time; "saved" is a
  // chosen saved place. Drives the numbered list in the companion modal and the
  // waypoints[] sent to the backend (which already splits the route into legs).
  const [plannedStops, setPlannedStops] = useState<PlannedStop[]>([]);
  /** The route request is in flight, so the trip sheet can open before it lands. */
  const [routePending, setRoutePending] = useState(false);
  /*
   * Every leg of the drawn route, including its turns.
   *
   * `legGeometries` is only populated for multi-stop trips, so the single
   * destination case — which is most trips — had nowhere to keep a turn list.
   */
  const [routeLegs, setRouteLegs] = useState<LegInfo[] | null>(null);
  /** Other ways of getting there, offered before setting off. */
  const [routeAlternatives, setRouteAlternatives] = useState<
    Array<{ distanceMeters: number; durationSeconds: number; geometry: unknown; legs: LegInfo[] }>
  >([]);
  // Mirrors the module's own flag so the button re-renders when it changes.
  const [voiceOn, setVoiceOn] = useState(true);
  useEffect(() => setVoiceOn(isVoiceEnabled()), []);
  /** Planning a route for one person — same stops, no invite. */
  const [soloPlanOpen, setSoloPlanOpen] = useState(false);
  /**
   * Open the solo planner for whatever is selected.
   *
   * Shared, because the choice lives in two places — a dialog on a phone and a
   * pair of buttons in the desktop panel — and only the phone one was ever
   * wired to anything but an immediate start.
   */
  // A declaration, not a useCallback: it reads `list` which is defined further
  // down, and only ever runs from an event handler, by which time it is bound.
  function openSoloPlanner() {
    if (!selectedId) return false;
    const loc = list.data?.find((l) => l.id === selectedId);
    if (!loc) return false;
    setCompanionLocationId(loc.id);
    setCompanionLocationName(loc.name);
    setPlannedStops([]);
    setStopPickerOpen(false);
    setSoloPlanOpen(true);
    return true;
  }
  const [stopPickerOpen, setStopPickerOpen] = useState(false);
  const [pendingSentInviteId, setPendingSentInviteId] = useState<string | null>(null);
  const [rejectedMessage, setRejectedMessage] = useState<string | null>(null);
  const sendInvite = trpc.location.sendNavInvite.useMutation();
  const cancelInvite = trpc.location.cancelNavInvite.useMutation({
    onSuccess: () => toast("Đã huỷ lời mời", "success"),
    onError: (err) => toast(readableFormError(err.message), "error")
  });
  const endNavTrip = trpc.location.endNavTrip.useMutation({
    onSuccess: () => toast("Đã kết thúc chuyến đi", "success"),
    onError: (err) => toast(readableFormError(err.message), "error")
  });
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
  // Invite id of the trip we already auto-started, so each accepted trip starts
  // exactly once even when it arrives twice (SSE event + polling fallback).
  const handledInviteRef = useRef<string | null>(null);
  const nav = useNavigation();
  /*
   * Where to draw the other person.
   *
   * Two different questions were being answered by one flag. Riding together is
   * what decides whether their route, HUD and meeting flare belong on screen —
   * gating those on it is what stopped a solo ride from wearing the two-person
   * interface. But simply showing where they are is not that: it is the
   * ordinary state of a shared map, and gating it the same way meant a couple
   * who both had the map open still each saw an empty one.
   *
   * So their pin shows whenever we know where they are, and goes away for the
   * length of a ride someone chose to take alone.
   */
  /*
   * Publish the height of the floating control dock so the map can keep its own
   * controls clear of it.
   *
   * A page-level custom property rather than a prop: the pill lives inside the
   * map component, the dock is painted over the map by the page, and neither
   * is an ancestor of the other. This is the same shape of fact as a safe-area
   * inset — something the page knows and anything drawing near the bottom edge
   * needs.
   */
  const navDockRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const setVar = (h: number) =>
      document.documentElement.style.setProperty("--nav-dock-h", `${Math.round(h)}px`);
    const el = navDockRef.current;
    if (!el) {
      setVar(0);
      return;
    }
    // Border-box height, not contentRect: the dock carries its own padding plus
    // the safe-area inset, and the pill has to clear all of it.
    const measure = () => setVar(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      setVar(0);
    };
  }, [nav.isNavigating]);

  const partnerPin =
    isCompanionTrip || !nav.isNavigating ? nav.partnerLocation : null;
  /*
   * When the current ride started, so it can be written to the history.
   *
   * A ref rather than state: nothing renders from it, and it must survive the
   * re-renders that a live GPS stream causes several times a second.
   */
  const rideStartedAt = useRef<Date | null>(null);
  const recordRide = trpc.ride.record.useMutation();
  useEffect(() => {
    if (nav.isNavigating && !rideStartedAt.current) rideStartedAt.current = new Date();
  }, [nav.isNavigating]);

  /*
   * Re-routing stays on this page rather than moving into the provider: it
   * needs this page's state — which leg is active, what is selected, the query
   * client. The provider owns the GPS watch so a journey survives leaving here,
   * and calls back into whatever handler is registered.
   *
   * Kept in a ref and registered once. Registering the closure itself would
   * re-register on every render that touches leg state — harmless, but pointless
   * churn on a hot path, and it makes the subscription look load-bearing.
   */
  const offRouteRef = useRef<((geo: LatLng) => void) | null>(null);
  offRouteRef.current = async (currentGeo: LatLng) => {
      if (isRecalculating.current) return;
      // On a multi-leg trip, re-route ONLY the active leg: current position →
      // that leg's end point. Upcoming legs are left untouched on the map.
      if (legGeometries && !legArrived) {
        isRecalculating.current = true;
        try {
          const endpoint = legEndpoint(legGeometries[currentLegIndex]);
          const r = await utils.location.getRoute.fetch({ destination: endpoint, origin: currentGeo });
          const leg = r.legs[0];
          const coords = leg?.geometry.coordinates ?? [];
          setLegGeometries((prev) =>
            prev ? prev.map((l, i) => (i === currentLegIndex ? (leg ?? l) : l)) : prev,
          );
          if (coords.length) {
            nav.setRouteInfo(coords, leg?.distanceMeters ?? r.distanceMeters, leg?.durationSeconds ?? r.durationSeconds);
            // Only once the new line is actually in hand: saying it has been
            // redrawn while the request is still out, or after it failed, is a
            // promise the map has not kept.
            speak(rerouteLine(), { chime: true });
          }
        } catch (err) {
          console.error("Lỗi tính lại chặng đang đi", err);
        } finally {
          setTimeout(() => { isRecalculating.current = false; }, 5000);
        }
        return;
      }
      if (!selectedId) return;
      isRecalculating.current = true;
      try {
        const r = await utils.location.getRoute.fetch({ destinationId: selectedId, origin: currentGeo });
        setRouteGeometry(r.geometry);
        // The turns belong to the line. Without this the map redrew around the
        // detour while the voice carried on down the road that was abandoned —
        // worse than saying nothing, because it is confidently wrong.
        setRouteLegs(r.legs);
        setRouteDistanceMeters(r.distanceMeters);
        setRouteDurationSeconds(r.durationSeconds);
        const coords = (r.geometry as { coordinates?: Array<[number, number]> }).coordinates;
        if (coords) {
          nav.setRouteInfo(coords, r.distanceMeters, r.durationSeconds);
          speak(rerouteLine(), { chime: true });
        }
      } catch (err) {
        console.error("Lỗi tính lại đường đi", err);
      } finally {
        // Wait a bit before allowing another recalculation to avoid spamming
        setTimeout(() => { isRecalculating.current = false; }, 5000);
      }
    
  };
  useEffect(
    () => nav.setOffRouteHandler((geo) => offRouteRef.current?.(geo)),
    [nav],
  );


  const liveUser = nav.userGeo ?? userGeo;
  /*
   * What to draw and what to point the camera at while a route is being followed.
   *
   * The snapped pair when there is one, the raw fix otherwise. Snapping is what
   * keeps the dot on the road instead of drifting through buildings, and takes
   * the map's rotation from the road's own direction rather than a compass that
   * spins while stopped at a light.
   */
  const shownUser = nav.snappedGeo ?? liveUser;
  const shownHeading = nav.snappedHeading ?? nav.heading;

  /*
   * Turn-by-turn for the leg currently being ridden.
   *
   * Only while actually navigating: the turns exist as soon as the route is
   * drawn, but announcing them to someone still looking at the map deciding
   * whether to go is noise.
   */
  const activeLeg = useMemo(() => {
    /*
     * `legGeometries` first, because it is the one a reroute keeps current.
     *
     * A multi-stop trip that goes off course replaces the active leg in
     * `legGeometries` and leaves `routeLegs` holding the original — so reading
     * the latter meant the banner announced turns from a route nobody was on
     * any more. Preferring the live one removes the choice.
     */
    const legs = legGeometries ?? routeLegs;
    if (!legs?.length) return null;
    return legs[Math.min(currentLegIndex, legs.length - 1)] ?? null;
  }, [legGeometries, routeLegs, currentLegIndex]);

  const utils = trpc.useUtils();
  const configQuery = trpc.location.getConfig.useQuery();
  const categories = configQuery.data?.categories || [];
  const districts = configQuery.data?.districts || [];

  /*
   * Debounced so typing does not fire a query per keystroke. 250ms is short
   * enough to feel immediate and long enough that a normal typing burst is one
   * request.
   */
  const [queryText, setQueryText] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(queryText.trim()), 250);
    return () => clearTimeout(t);
  }, [queryText]);

  // These three overlays are hand-rolled rather than built on <Modal>, so they
  // inherit none of its keyboard behaviour. Escape at minimum.
  useEscapeKey(showEndConfirm, () => setShowEndConfirm(false));
  useEscapeKey(showMidpointModal, () => setShowMidpointModal(false));
  useEscapeKey(Boolean(navInvites.endedTrip), () => navInvites.clearEndedTrip());

  const [filtersOpen, setFiltersOpen] = useState(false);
  /** Shown on the collapsed filter button so an active filter is never hidden. */
  const activeFilterCount =
    (district ? 1 : 0) + (category ? 1 : 0) + (status ? 1 : 0);

  /*
   * The point a chosen suggestion put on the map, held apart from the form's
   * values so the map can draw it. It is not saved until the form is
   * submitted — the pin is there to be looked at and corrected first.
   */
  const [draftGeo, setDraftGeo] = useState<LatLng | null>(null);
  /** The form is open but standing aside so a point can be tapped on the map. */
  const [pickingGeo, setPickingGeo] = useState(false);
  const [draftHint, setDraftHint] = useState<null | "exact" | "approx">(null);

  /**
   * Where the map is looking. Place search is biased by this.
   *
   * Published guidance is to bias autocomplete by the map's viewport whenever a
   * map is present, and that is the only source that always has an answer:
   * GPS may be denied, and a saved-place list may be empty. Whatever the map is
   * showing is, by definition, the area the person is looking at.
   */
  const [mapCenter, setMapCenter] = useState<LatLng | null>(null);
  /*
   * Emotion pings, and why a tap might not send one.
   *
   * The send refuses in two ordinary situations — no GPS fix yet, and inside
   * the 2.5s spam guard — and both used to be a bare `return`. Four buttons
   * that answer nothing at all read as broken, so the refusal is now spoken:
   * the missing-fix case says why, and the guard is drawn on the buttons.
   */
  const [pingCooling, setPingCooling] = useState(false);
  async function sendPing(action: string) {
    const result = await nav.sendPingAction?.(action);
    if (result === "no-location")
      toast("Chưa bắt được vị trí của bạn nên chưa gửi được — bật định vị rồi thử lại nhé", "error");
  }
  useEffect(() => {
    const wait = nav.pingReadyAt - Date.now();
    if (wait <= 0) { setPingCooling(false); return; }
    setPingCooling(true);
    const t = setTimeout(() => setPingCooling(false), wait);
    return () => clearTimeout(t);
  }, [nav.pingReadyAt]);

  /**
   * Whether the floating tool column is showing on desktop.
   *
   * Even narrowed, the column plus the app sidebar cover most of the left half
   * of a laptop screen, and the map behind them is the point of the page. This
   * is the same move a map application makes: let the panel get out of the way,
   * and leave one control to bring it back.
   */
  const { isCollapsed: sidebarCollapsed } = useSidebar();
  const [panelOpen, setPanelOpen] = useState(true);

  /**
   * Whether the saved-place list is showing on desktop.
   *
   * Closed to begin with. The tools belong over the map; the full list does
   * not, and stacking it under them made one tall cluster that covered the
   * left of the screen at every desktop width. The count chip opens it.
   */
  const [listOpen, setListOpen] = useState(false);

  /*
   * The add/edit form renders inside the saved-place panel, so the panel has
   * to be open whenever the form is.
   *
   * Here rather than at each call site: the form can be opened from the
   * toolbar, from a search suggestion, from tapping the map and from the
   * empty state, and closing the panel by default left "+ Thêm" flipping to
   * "Đóng" with nothing on screen.
   */
  useEffect(() => {
    if (formOpen) setListOpen(true);
  }, [formOpen]);

  /*
   * One cheap position fix on arrival, so the map opens where the person is.
   * Low accuracy and a generous cache age: this is for choosing a city, not for
   * navigating, and a coarse fix from the last few minutes answers that. Denial
   * is silent — the map keeps its default and search biases to that instead.
   */
  /*
   * Opening this page is what shares a position — which is what the app has
   * always said, and never did. Presence stays on while the map is open and
   * goes off on the way out; navigation, when it starts, takes over with its
   * own faster loop.
   */
  const setPresence = nav.setPresence;
  useEffect(() => {
    setPresence(true);
    return () => setPresence(false);
  }, [setPresence]);

  const askedForFix = useRef(false);
  useEffect(() => {
    if (askedForFix.current || !navigator.geolocation) return;
    askedForFix.current = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  const listInput = useMemo(
    () => ({
      district: district || undefined,
      category: category || undefined,
      status: (status || undefined) as "want_to_go" | "visited" | undefined,
      q: debouncedQuery || undefined,
    }),
    [district, category, status, debouncedQuery],
  );
  const list = trpc.location.list.useQuery(listInput);
  const toggle = trpc.location.toggleStatus.useMutation({
    // Optimistic flip: the status pill switches the instant it's tapped instead
    // of waiting for the server + a list refetch. On error we roll the cache
    // back; either way we re-sync on settle so a filtered view self-corrects.
    onMutate: async ({ id }) => {
      await utils.location.list.cancel(listInput);
      const prev = utils.location.list.getData(listInput);
      utils.location.list.setData(listInput, (old) =>
        old?.map((l) =>
          l.id === id
            ? { ...l, status: l.status === "visited" ? "want_to_go" : "visited" }
            : l,
        ),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.location.list.setData(listInput, ctx.prev);
      toast(readableFormError(_err.message), "error");
    },
    onSuccess: () => toast("Đã chuyển trạng thái", "success"),
    onSettled: () => utils.location.list.invalidate(),
  });
  const remove = trpc.location.remove.useMutation({
    onSuccess: () => { utils.location.list.invalidate(); toast("Đã xoá địa điểm", "success"); },
    onError: (err) => toast(readableFormError(err.message), "error")
  });
  
  // Detect if partner is stuck
  useEffect(() => {
    // Only for a trip taken together: on a solo ride the other person standing
    // still is not information, it is their business.
    const speed = isCompanionTrip ? nav.partnerLocation?.speedKmH : undefined;
    if (speed != null && speed < 3) {
      if (!stationaryTimeoutRef.current) {
        stationaryTimeoutRef.current = setTimeout(() => {
          setShowTrafficWarning(true);
          buzz([200, 100, 200], { urgent: true });
        }, 10_000); // 10 seconds for testing
      }
    } else {
      if (stationaryTimeoutRef.current) {
        clearTimeout(stationaryTimeoutRef.current);
        stationaryTimeoutRef.current = null;
      }
      setShowTrafficWarning(false);
    }
  }, [isCompanionTrip, nav.partnerLocation?.speedKmH]);

  // Cleanup timeout ONLY on unmount to prevent resetting on minor speed fluctuations (e.g. 0 -> 2 -> 0)
  useEffect(() => {
    return () => {
      if (stationaryTimeoutRef.current) clearTimeout(stationaryTimeoutRef.current);
    };
  }, []);
  const { data: session } = authClient.useSession();
  const members = trpc.space.members.useQuery();
  
  const userAvatar = session?.user.image || undefined;
  /*
   * Who the other person is. `isSelf` comes from the server, which knows; the
   * old comparison against the session id read every member as the partner for
   * however long the session took to arrive.
   */
  const partner = usePartner();
  const partnerAvatar = partner?.image || undefined;
  const partnerName = partner?.name?.trim() || "Người kia";
  const hasTwoMembers = (members.data?.length ?? 0) >= 2;
  /* Read from the live list rather than copied into state when the pin was
     picked — one source of truth with what the map is drawing. */
  const selectedName = selectedId
    ? (list.data?.find((l) => l.id === selectedId)?.name ?? null)
    : null;

  /*
   * Name and side of the destination, for the closing sentence of a ride.
   *
   * Only on the FINAL leg. An intermediate stop ends in an arrival manoeuvre
   * too, and "tới rồi, Cà phê Sỏi Đá ở bên phải" announced at a stop halfway
   * through would be naming somewhere the rider is not going yet.
   *
   * The side compares the direction of travel over the last stretch of the line
   * with the direction from where the line ends to the pin itself — the route
   * stops where the road comes closest to the place, not at the place.
   */
  const arrivalContext = useMemo(() => {
    const legs = legGeometries ?? routeLegs;
    const onFinalLeg = !legs?.length || currentLegIndex >= legs.length - 1;
    if (!onFinalLeg) return null;
    const geo = selectedId ? (list.data?.find((l) => l.id === selectedId)?.geo ?? null) : null;
    const coords = activeLeg?.geometry?.coordinates ?? null;
    return {
      name: selectedName,
      side: geo && coords?.length ? destinationSide(coords, geo) : null,
    };
  }, [legGeometries, routeLegs, currentLegIndex, selectedId, list.data, selectedName, activeLeg]);

  const turn = useTurnByTurn({
    maneuvers: activeLeg?.maneuvers ?? null,
    /*
     * The same leg's line, because that is what the manoeuvre offsets are
     * measured along. Reading the turns from one leg and the geometry from
     * another would put every distance out by the difference between them.
     */
    coordinates: activeLeg?.geometry?.coordinates ?? null,
    userGeo: nav.userGeo,
    active: nav.isNavigating,
    arrival: arrivalContext,
  });

  /*
   * The floating window redraws the turn ahead rather than mirroring the map,
   * so it reads at a size where tiles and street labels would not.
   */
  const miniFrame = useMemo<MiniNavFrame>(
    () => ({
      route: activeLeg?.geometry?.coordinates ?? null,
      geo: nav.snappedGeo ?? nav.userGeo,
      heading: nav.snappedHeading ?? nav.heading,
      turnArrow: turn.next ? maneuverArrow(turn.next.type) : null,
      turnLabel: turn.next ? maneuverLabel(turn.next) : null,
      turnMetres: turn.metres ?? null,
      remainingMeters: nav.remainingMeters,
      remainingSeconds: nav.remainingSeconds,
      destination: selectedName ?? null,
      paused: pausedTrip,
    }),
    [
      activeLeg,
      nav.snappedGeo,
      nav.userGeo,
      nav.snappedHeading,
      nav.heading,
      nav.remainingMeters,
      nav.remainingSeconds,
      turn.next,
      turn.metres,
      selectedName,
      pausedTrip,
    ],
  );
  /*
   * Fullscreen for the ride, on a phone.
   *
   * Not for looks: it is the precondition for the small window opening by
   * itself on Android. Chrome there sends one thing to picture-in-picture when
   * Home is pressed — a playing video it counts as fullscreen — and a
   * full-viewport video inside a fullscreen document counts. So the document
   * goes fullscreen from the tap that starts the ride (the platform wants a
   * gesture, and the route's arrival is far too late to still have one), and the
   * stream behind the map is that video. FullscreenRecovery drops it the moment
   * the app is looked at again, and it is dropped here when the ride ends.
   */
  const [coarsePointer, setCoarsePointer] = useState(false);
  useEffect(() => {
    setCoarsePointer(window.matchMedia?.("(pointer: coarse)").matches ?? false);
  }, []);
  const immersiveOn = useRef(false);
  const enterImmersive = useCallback(() => {
    if (!coarsePointer || !document.fullscreenEnabled || document.fullscreenElement) return;
    immersiveOn.current = true;
    document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {
      immersiveOn.current = false;
    });
  }, [coarsePointer]);
  useEffect(() => {
    if (nav.isNavigating || pausedTrip || !immersiveOn.current) return;
    immersiveOn.current = false;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  }, [nav.isNavigating, pausedTrip]);

  const miniWindow = useNavMiniWindow(miniFrame, {
    enabled: nav.isNavigating || pausedTrip,
    autoOpen: nav.isNavigating && !pausedTrip,
    immersive: coarsePointer,
  });

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
    if (
      isCompanionTrip &&
      selectedId &&
      nav.partnerLocation &&
      !partnerRouteGeometry &&
      !isRecalculating.current
    ) {
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
  }, [isCompanionTrip, selectedId, nav.partnerLocation?.lat, nav.partnerLocation?.lng, partnerRouteGeometry, utils.location]);

  // Subscribe to the accepted-trip store so we react when an invite is accepted
  // (either partner). The store survives client navigation (module-level) and is
  // read on mount, so it drives auto-start for both "already on /map" and
  // "navigated here" cases — no URL params needed.
  useEffect(() => {
    setAcceptedTrip(acceptedTripStore.get());
    return acceptedTripStore.subscribe(setAcceptedTrip);
  }, []);

  // Auto-start navigation when an accepted trip lands in the store. Guarded by
  // invite id so it runs exactly once per trip even if the same trip arrives via
  // both the SSE event and the polling fallback. The old `!selectedId` guard
  // blocked this when a pin was already selected (required a reload).
  useEffect(() => {
    if (!acceptedTrip) return;
    // The user ended this trip earlier; ignore the server's re-delivery so a
    // reload doesn't drop us back into a finished trip.
    if (isTripEnded(acceptedTrip.inviteId)) {
      acceptedTripStore.set(null);
      handledInviteRef.current = acceptedTrip.inviteId;
      return;
    }
    if (!list.data) return;
    if (handledInviteRef.current === acceptedTrip.inviteId) return;
    handledInviteRef.current = acceptedTrip.inviteId;

    const { locationId, waypoints, role } = acceptedTrip;
    // Consume the store now so a missing/deleted pin can't leave a stale trip.
    acceptedTripStore.set(null);
    // The invite is handled regardless of whether the destination renders in the
    // current (possibly filtered) list — clear the waiting spinner unconditionally
    // so the sender never gets stuck (and the status poll stops) when the pin is
    // filtered out or deleted.
    setPendingSentInviteId(null);

    const loc = list.data.find(l => l.id === locationId);
    if (!loc?.geo) {
      // Destination isn't in the current (possibly filtered) list, or was deleted.
      // Don't silently swallow the accepted trip — tell the user why nothing happened.
      toast("Không mở được chuyến đi: địa điểm không còn nữa hoặc đang bị bộ lọc ẩn đi.", "error");
      return;
    }

    // Convert invite Waypoint[] to the {lat,lng}[] shape getRoute expects.
    const waypointGeos = waypoints.map(w => ({ lat: w.lat, lng: w.lng }));

    goToLocation(loc.id, loc.geo, waypointGeos, { withPartner: true });
    // Remember which invite backs this trip so End can mark it finished.
    setCurrentTripInviteId(acceptedTrip.inviteId);
    // Friendly notice tailored to each side: the sender hears their invite was
    // accepted; the receiver (who just tapped "Đi liền") gets a go-together nudge.
    setAcceptedMessage(
      role === "receiver"
        ? "Cùng xuất phát nào 🛵"
        : `Yayy! ${partnerName} đồng ý rồi, mình xuất phát thôi 💞`,
    );
    setTimeout(() => setAcceptedMessage(null), 4000);
    setTimeout(() => {
      setFocusGeo(null);
      nav.start();
    }, 2000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.data, acceptedTrip]);

  // Reconciliation fallback: while waiting for the partner to accept, poll the
  // sent invite's status. The SSE invite-response is pushed only once on the
  // transition, so a single dropped frame would otherwise hang the sender here.
  // Whichever source (SSE or this poll) lands first wins; the invite-id guard in
  // the auto-start effect makes the duplicate a no-op.
  const sentInviteStatus = trpc.location.sentInviteStatus.useQuery(
    { inviteId: pendingSentInviteId ?? "" },
    { enabled: !!pendingSentInviteId, refetchInterval: 2500 },
  );
  useEffect(() => {
    if (!pendingSentInviteId || !sentInviteStatus.data) return;
    const { status, locationId, waypoints } = sentInviteStatus.data;
    if (status === "accepted" && locationId) {
      acceptedTripStore.set({
        inviteId: pendingSentInviteId,
        locationId,
        waypoints,
        role: "sender",
      });
    } else if (status === "rejected" || status === "expired") {
      setPendingSentInviteId(null);
      setRejectedMessage(`Hí, ${partnerName} bận xíu hoặc lỡ tay rồi — rủ lại sau nha 🥺`);
      setTimeout(() => setRejectedMessage(null), 4000);
    }
  }, [sentInviteStatus.data, pendingSentInviteId, partnerName]);

  // Listen for invite rejection from GlobalInviteListener
  useEffect(() => {
    const handleRejected = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.id === pendingSentInviteId) {
        setPendingSentInviteId(null);
        setRejectedMessage(`Hí, ${partnerName} bận xíu hoặc lỡ tay rồi — rủ lại sau nha 🥺`);
        setTimeout(() => setRejectedMessage(null), 4000);
      }
    };
    window.addEventListener("invite-rejected", handleRejected);
    return () => window.removeEventListener("invite-rejected", handleRejected);
  }, [pendingSentInviteId, partnerName]);
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
          name: `Vị trí của ${partnerName}`,
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
          toast("Đã gửi lời mời 💌");
        },
        onError: () => toast("Gửi lời mời thất bại", "error"),
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
    /**
     * `withPartner` has to be passed in rather than read from state.
     *
     * This function CLEARS `currentTripInviteId` on entry — a manual trip
     * carries no invite — and the accepted-invite handler sets it again on the
     * line after calling this. So inside here the state still says "solo" even
     * for a companion trip, and always will.
     */
    opts?: { askChoice?: boolean; withPartner?: boolean },
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
    /*
     * Ask now, while the route is still being fetched.
     *
     * This dialog used to wait for the drawn route, on the reasoning that
     * offering to start a trip that failed to draw is worse than no dialog.
     * True, but the cost was that pressing "Chỉ đường" did nothing visible for
     * as long as geolocation plus the routing service took — seconds on a slow
     * connection, which reads as a dead button. The dialog appears at once and
     * its actions stay disabled until there is something to start.
     */
    /*
     * Asking is now the caller's decision, not something inferred from whether
     * waypoints happened to be present.
     *
     * It used to open whenever there were no waypoints, which made the solo
     * planner reopen the very sheet it had just been chosen from: planning no
     * stops means passing no waypoints, so redrawing the route counted as a
     * fresh manual "Chỉ đường". The sheet came back, navigation started 1.2s
     * later and covered it, and pressing "Kết thúc" revealed it again — three
     * complaints, one condition.
     */
    setRoutePending(true);
    if (opts?.askChoice && typeof window !== "undefined" && window.innerWidth < 1024) {
      setSheetCollapseTick((t) => t + 1);
      setTripChoiceOpen(true);
    }
    // Reset any prior multi-leg trip before drawing the new one.
    setLegGeometries(null);
    setCurrentLegIndex(0);
    setLegArrived(false);
    legArmedRef.current = false;
    setPausedTrip(false);
    // A manual "Chỉ đường" trip carries no companion invite; clear any stale id
    // so ending it never marks an unrelated invite as finished.
    setCurrentTripInviteId(null);
    if (!navigator.geolocation) {
      setRouteError("Trình duyệt không hỗ trợ định vị.");
      setRoutePending(false);
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

          // Their route is drawn only when this is a trip they agreed to. Being
          // online is not agreement.
          if (opts?.withPartner && nav.partnerLocation) {
            reqs.push(utils.location.getRoute.fetch({
              destinationId: id,
              origin: { lat: nav.partnerLocation.lat, lng: nav.partnerLocation.lng },
              ...(waypoints && waypoints.length > 0 ? { waypoints } : {}),
            }));
          }

          const [r, partnerR] = await Promise.all(reqs);

          setRouteDistanceMeters(r.distanceMeters);
          setRouteDurationSeconds(r.durationSeconds);

          // Multi-stop trip: split into coloured legs and navigate the first one.
          // Otherwise keep the single merged polyline (the common case).
          /*
           * The turn list, kept per leg so a multi-stop trip announces the leg
           * being ridden rather than the whole trip's turns at once.
           */
          setRouteLegs(r.legs);
          setRouteAlternatives(r.alternatives ?? []);
          const isMultiLeg = !!waypoints && waypoints.length > 0 && r.legs.length > 1;
          if (isMultiLeg) {
            setLegGeometries(r.legs);
            setCurrentLegIndex(0);
            setLegArrived(false);
            setRouteGeometry(null); // legs are drawn instead of the merged line
            const first = r.legs[0];
            nav.setRouteInfo(first.geometry.coordinates, first.distanceMeters, first.durationSeconds, r.legs);
          } else {
            setLegGeometries(null);
            setRouteGeometry(r.geometry);
            const coords = (r.geometry as { coordinates?: Array<[number, number]> }).coordinates;
            if (coords) {
              nav.setRouteInfo(coords, r.distanceMeters, r.durationSeconds);
            }
          }

          // Always cleared, because it is always set: the flag now means "a
          // route is being fetched" for every caller, not just the one that
          // happens to have a sheet waiting on it.
          setRoutePending(false);

          if (partnerR) {
            setPartnerRouteGeometry(partnerR.geometry);
            setPartnerRouteDistanceMeters(partnerR.distanceMeters);
            setPartnerRouteDurationSeconds(partnerR.durationSeconds);
          } else {
            setPartnerRouteGeometry(null);
            setPartnerRouteDistanceMeters(null);
            setPartnerRouteDurationSeconds(null);
          }
        } catch {
          setRouteError("Không vẽ được đường đi (kiểm tra STADIA_API_KEY).");
          setRoutePending(false);
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
        setRoutePending(false);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  }

  // Detect reaching the active leg's end point. `remainingMeters` is measured
  // against the active leg only, so this fires per stop rather than per trip.
  useEffect(() => {
    if (!legGeometries || legArrived) return;
    const rem = nav.remainingMeters;
    if (rem == null) return;
    // Arm only after the rider is genuinely under way on this leg.
    if (!legArmedRef.current) {
      if (rem > LEG_ARRIVE_THRESHOLD_M) legArmedRef.current = true;
      return;
    }
    if (rem < LEG_ARRIVE_THRESHOLD_M) {
      legArmedRef.current = false;
      setLegArrived(true);
      buzz([120, 80, 120], { urgent: true });
    }
  }, [nav.remainingMeters, legGeometries, legArrived]);

  // Confirm the current stop and start the next leg. Re-routes the next leg from
  // the rider's current position so only its two end points drive the new route.
  const handleAdvanceLeg = async () => {
    if (!legGeometries) return;
    const total = legGeometries.length;
    const nextIdx = currentLegIndex + 1;
    // Final leg just finished → whole trip done. End it fully (and mark the
    // invite finished) so a reload can't drop us back into the completed trip.
    if (nextIdx >= total) {
      endTrip();
      setAcceptedMessage("Tới nơi rồi! Chuyến đi hoàn tất 🎉");
      setTimeout(() => setAcceptedMessage(null), 5000);
      return;
    }
    const cur = nav.userGeo ?? userGeo;
    const planned = legGeometries[nextIdx];
    setCurrentLegIndex(nextIdx);
    setLegArrived(false);
    legArmedRef.current = false;
    if (cur) {
      try {
        const r = await utils.location.getRoute.fetch({ destination: legEndpoint(planned), origin: cur });
        const leg = r.legs[0];
        if (leg) {
          setLegGeometries((prev) => (prev ? prev.map((l, i) => (i === nextIdx ? leg : l)) : prev));
          nav.setRouteInfo(leg.geometry.coordinates, leg.distanceMeters, leg.durationSeconds);
        } else {
          nav.setRouteInfo(planned.geometry.coordinates, planned.distanceMeters, planned.durationSeconds);
        }
      } catch {
        nav.setRouteInfo(planned.geometry.coordinates, planned.distanceMeters, planned.durationSeconds);
      }
    } else {
      nav.setRouteInfo(planned.geometry.coordinates, planned.distanceMeters, planned.durationSeconds);
    }
    setLegMessage(`Bắt đầu chặng ${nextIdx + 1}/${total} 🛵`);
    setTimeout(() => setLegMessage(null), 4000);
    buzz(80);
  };

  /*
   * "Begin as soon as the route is drawn."
   *
   * The solo planner used to call nav.start() behind a 1200ms setTimeout, which
   * is a guess at how long routing takes: quicker, and the map jumps before the
   * line is there; slower, and navigation begins with no route at all and no
   * way to tell. Waiting on the request itself is both correct and shorter in
   * the common case — and it can refuse to start when the route failed, which a
   * timer cannot.
   */
  const [autoStartWhenRouted, setAutoStartWhenRouted] = useState(false);
  useEffect(() => {
    if (!autoStartWhenRouted || routePending) return;
    setAutoStartWhenRouted(false);
    if (routeError) return;
    setFocusGeo(null);
    nav.start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartWhenRouted, routePending, routeError]);

  /*
   * Put away every dialog that belongs to starting a trip.
   *
   * They were closed one at a time by whoever happened to open the next one,
   * which left whichever was missed sitting behind the full-screen navigation
   * overlay — visible again the moment the trip ended, asking a question that
   * no longer had a subject.
   */
  const closeTripDialogs = () => {
    setTripChoiceOpen(false);
    setShowCompanionChoice(false);
    setSoloPlanOpen(false);
    setStopPickerOpen(false);
    setPlannedStops([]);
  };

  // Wipe all live-trip state back to a clean map (no route, no legs, not paused).
  const resetTrip = () => {
    nav.stop();
    closeTripDialogs();
    setPausedTrip(false);
    setLegGeometries(null);
    setCurrentLegIndex(0);
    setLegArrived(false);
    legArmedRef.current = false;
    setLegMessage(null);
    setRouteGeometry(null);
    setRouteDistanceMeters(null);
    setRouteDurationSeconds(null);
    setPartnerRouteGeometry(null);
    setPartnerRouteDistanceMeters(null);
    setPartnerRouteDurationSeconds(null);
    setSelectedId(null);
  };

  /*
   * Navigation has begun, so every question about how to begin is answered.
   * Belt and braces on top of each button closing its own dialog: whatever was
   * missed would otherwise sit under the full-screen overlay, unreachable and
   * still open.
   */
  useEffect(() => {
    if (nav.isNavigating) closeTripDialogs();
  }, [nav.isNavigating]);

  // Temporarily leave navigation without ending the trip — GPS watch stops to
  // save battery, but the route stays so Resume can re-enter it.
  const pauseTrip = () => {
    setPausedTrip(true);
    nav.stop();
  };

  const resumeTrip = () => {
    setPausedTrip(false);
    nav.start();
  };

  // End the trip for good: reset everything and remember the invite as finished
  // so the server's re-delivery can't auto-start it again after a reload.
  /*
   * Write the finished ride to the history.
   *
   * Distance is what was actually covered — the planned length minus whatever
   * was still ahead when it ended — rather than the plan, because a trip cut
   * short did not cover the plan. Very short or barely-moved trips are dropped:
   * a mistaken tap should not leave a keepsake behind.
   */
  const saveRideIfWorthKeeping = () => {
    const startedAt = rideStartedAt.current;
    rideStartedAt.current = null;
    if (!startedAt) return;
    const endedAt = new Date();
    const durationSeconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);
    const planned = routeDistanceMeters ?? 0;
    const covered = Math.max(0, planned - (nav.remainingMeters ?? 0));
    if (durationSeconds < 60 || covered < 100) return;
    recordRide.mutate({
      destinationName: selectedName ?? "Chuyến đi",
      startedAt,
      endedAt,
      distanceMeters: Math.round(covered),
      durationSeconds,
      companion: !!currentTripInviteId,
    });
  };

  /*
   * Take one of the other routes.
   *
   * Everything needed is already in hand — the line, the totals and the turn
   * list came back with it — so this is a swap rather than a fresh request. The
   * turn list moving with the line is the part that matters: a route you can see
   * but cannot be guided along would make choosing it a downgrade.
   */
  const chooseAlternative = (i: number) => {
    const alt = routeAlternatives[i];
    if (!alt) return;
    const coords = (alt.geometry as { coordinates?: Array<[number, number]> }).coordinates ?? [];
    if (!coords.length) return;
    setLegGeometries(null);
    setRouteGeometry(alt.geometry);
    setRouteLegs(alt.legs);
    setRouteDistanceMeters(alt.distanceMeters);
    setRouteDurationSeconds(alt.durationSeconds);
    nav.setRouteInfo(coords, alt.distanceMeters, alt.durationSeconds);
    // The one just taken is no longer an alternative to itself.
    setRouteAlternatives((prev) => prev.filter((_, k) => k !== i));
  };

  const endTrip = () => {
    saveRideIfWorthKeeping();
    if (currentTripInviteId) {
      markTripEnded(currentTripInviteId);
      // Tell the server so the partner gets the "they ended — stop too?" prompt.
      endNavTrip.mutate({ inviteId: currentTripInviteId });
    }
    acceptedTripStore.set(null);
    setCurrentTripInviteId(null);
    setShowEndConfirm(false);
    navInvites.clearEndedTrip();
    resetTrip();
  };

  // If the partner ended but this user isn't actually on a trip, there's nothing
  // to prompt about — drop the signal silently.
  useEffect(() => {
    if (
      navInvites.endedTrip &&
      !nav.isNavigating &&
      !pausedTrip &&
      !legGeometries &&
      !routeGeometry
    ) {
      navInvites.clearEndedTrip();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navInvites.endedTrip, nav.isNavigating, pausedTrip, legGeometries, routeGeometry]);

  // Stable pin array so the memoised map only re-renders when the underlying
  // list actually changes — not on every filter/modal/form keystroke.
  const pins = useMemo(
    () =>
      (list.data ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        geo: l.geo,
        status: l.status,
      })),
    [list.data],
  );

  // Stable click handler for the same reason (inline arrow would bust the memo).
  const handleMapClick = useCallback(
    (geo: LatLng) => {
      if (!formOpen) return;
      setFormInitial((p) => ({ ...p, geo }));
      // Move the draft pin with the tap. Without this the map keeps showing
      // the looked-up point while the form already holds the corrected one,
      // so the correction appears not to have registered.
      setDraftGeo(geo);
      // One tap is the whole job: bring the form back with the point in it.
      setPickingGeo(false);
    },
    [formOpen],
  );

  // Prefer live remaining values; fall back to initial route totals.
  const displayDistance = nav.remainingMeters ?? routeDistanceMeters;
  const displayDuration = nav.remainingSeconds ?? routeDurationSeconds;

  /*
   * One spoken line as the ride starts.
   *
   * Said on the first render where navigation is on, with whatever figures are
   * known by then, and deliberately NOT held back until they arrive. Every
   * other announcement waits on a distance threshold — the first was 500 m out
   * — so a rider on a straight road heard nothing for a kilometre and had no
   * way to tell a working voice from a broken one. More importantly this is the
   * utterance iOS needs: the platform opens the audio route for the FIRST
   * utterance of a visit only while a user gesture is still in effect, and the
   * tap that starts the ride is the last such moment before the phone goes in
   * a pocket. Waiting for a route figure would spend it.
   */
  const departureSaid = useRef(false);

  /*
   * Said from the tap that starts the ride, not from an effect.
   *
   * It used to run in an effect on `isNavigating`, and on iOS that is the
   * difference between working and silent. The self-test in settings speaks
   * from inside its own onClick and is audible; the ride was not, because the
   * common path taps "Bắt đầu đi", waits for the route, and only then calls
   * nav.start() from an effect — by which time the user activation the platform
   * requires for the first utterance of a visit is long gone, and the engine
   * refuses without reporting anything. Speaking here puts it back inside the
   * tap, and that first real utterance is also what opens the audio route for
   * the turn instructions that follow, none of which can be in a gesture.
   *
   * `withNumbers` is false where the tap also triggers a re-route: the figures
   * still in state belong to the previous route, and a confidently spoken wrong
   * distance is worse than no distance.
   */
  const announceDeparture = useCallback(
    ({ withNumbers = true }: { withNumbers?: boolean } = {}) => {
      if (departureSaid.current) return;
      departureSaid.current = true;
      unlockAudio();
      speak(
        departureSentence({
          destination: selectedName,
          metres: withNumbers ? displayDistance : null,
          seconds: withNumbers ? displayDuration : null,
          partnerOnTheWay: isCompanionTrip && nav.partnerLocation != null,
          partnerName: partner?.name,
          // Rotates the opener by the day so it varies between rides but never
          // within one.
          dayIndex: new Date().getDate(),
        }),
        { chime: true },
      );
    },
    [selectedName, displayDistance, displayDuration, isCompanionTrip, nav.partnerLocation, partner?.name],
  );

  useEffect(() => {
    if (!nav.isNavigating) {
      departureSaid.current = false;
      // Hand the playback session back; holding it costs battery and keeps the
      // phone in a state where other apps duck for no reason.
      releaseAudio();
      return;
    }
    // Fallback for the paths with no tap behind them — an accepted invite
    // starts the ride from a timer. iOS may refuse this one; it is still better
    // than the ride beginning in silence on every other platform.
    announceDeparture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.isNavigating]);

  // ── Logic for Meet Me Halfway ──
  const partnerLocationRef = useRef(nav.partnerLocation);
  partnerLocationRef.current = nav.partnerLocation;

  /*
   * Re-rank the suggestions by how evenly the ride splits.
   *
   * Kept behind a tap because it costs six routing calls, and Stadia's matrix
   * endpoint — one request for the whole grid — is on a paid plan. Charging the
   * quota on every midpoint search would spend it on people who were happy
   * with the straight-line answer.
   */
  const [travelRanks, setTravelRanks] = useState<Record<string, { you: number; them: number; gap: number }> | null>(null);
  const [isRanking, setIsRanking] = useState(false);
  const rankByTravel = trpc.location.rankMeetingPoints.useMutation();
  const handleRankByTravel = useCallback(async () => {
    const partner = partnerLocationRef.current;
    const candidates = (midpointRecommendations ?? [])
      .filter((r) => r.geo)
      .slice(0, 3)
      .map((r) => ({ id: r.id as string, geo: r.geo as LatLng }));
    if (!userGeo || !partner || candidates.length === 0 || isRanking) return;
    setIsRanking(true);
    try {
      const ranked = await rankByTravel.mutateAsync({
        origins: [userGeo, { lat: partner.lat, lng: partner.lng }],
        candidates,
      });
      const byId: Record<string, { you: number; them: number; gap: number }> = {};
      for (const r of ranked) {
        byId[r.id] = { you: r.secondsFromYou, them: r.secondsFromPartner, gap: r.gapSeconds };
      }
      setTravelRanks(byId);
      // Reorder to match, fairest first, and keep any the router could not
      // reach at the end rather than dropping pins the person can see.
      const order = new Map(ranked.map((r, i) => [r.id, i]));
      setMidpointRecommendations((list) =>
        list
          ? [...list].sort(
              (x, y) =>
                (order.get(x.id) ?? Number.MAX_SAFE_INTEGER) -
                (order.get(y.id) ?? Number.MAX_SAFE_INTEGER),
            )
          : list,
      );
      setMidpointIndex(0);
    } finally {
      setIsRanking(false);
    }
  }, [midpointRecommendations, userGeo, isRanking, rankByTravel]);

  const handleFindMidpoint = useCallback(() => {
    setIsFindingMidpoint(true);
    setMidpointError(null);
    setTravelRanks(null);

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
          /*
           * The cached fix is only a shortcut when it is still fresh. It used
           * to be preferred unconditionally, which inverted the trust order:
           * the cache is never cleared once set (see use-live-navigation —
           * setPartnerLocation is never called with null, so the HUD does not
           * flicker on a lapsed poll), while the server query already filters
           * to recent pings. So the source with no freshness guarantee was
           * consulted first and the one with a guarantee second. Leaving the
           * map open while the other person closed theirs and moved across town
           * produced a "meeting point in the middle" computed from where they
           * had been an hour earlier, shown with no hint that it was old.
           */
          let partnerGeo: LatLng | null = null;
          const cached = partnerLocationRef.current;
          if (cached && cached.lat && cached.lng && isPartnerFixFresh(cached.updatedAt)) {
            partnerGeo = { lat: cached.lat, lng: cached.lng };
          } else {
            // Ask the server, which only returns fixes inside the same window.
            const partners = await pingLiveLocation.mutateAsync(origin);
            const partner = partners[0];
            if (partner && partner.lat && partner.lng) {
              partnerGeo = { lat: partner.lat, lng: partner.lng };
            }
          }

          if (!partnerGeo) {
            setMidpointError(`${partnerName} chưa mở trang Bản đồ gần đây nên mình chưa biết đang ở đâu. Nhờ ${partnerName} mở giúp trước nhé.`);
            setIsFindingMidpoint(false);
            return;
          }

          // Calculate midpoint
          const midpoint = calculateMidpoint(origin, partnerGeo);

          /*
           * Closest saved pins to the midpoint, preferring ones that are open
           * right now. Suggesting a place to meet that closed an hour ago is
           * the one way this feature can waste a trip, and the opening hours
           * were already on the record — the wheel had been using them while
           * this did not.
           *
           * Closed places are kept as a fallback rather than dropped: a
           * suggestion you have to check beats "no suggestions", and a place
           * with no hours entered counts as open (see isOpenAt).
           */
          const now = new Date();
          const withDistance = (list.data ?? [])
            .filter((p) => p.geo)
            .map((p) => ({
              ...p,
              distanceToMidpoint: calculateDistance(midpoint, p.geo!),
              isOpenNow: isOpenAt(p, now),
            }))
            .sort((a, b) => a.distanceToMidpoint - b.distanceToMidpoint);

          const openNow = withDistance.filter((p) => p.isOpenNow);
          const validPins = (openNow.length > 0 ? openNow : withDistance).slice(0, 3);

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
          setMidpointError(`Lỗi kết nối mạng khi tìm vị trí của ${partnerName}. Hãy thử lại.`);
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
  }, [pingLiveLocation, list.data, partnerName]);

  return (
    <>
      {/* Mounted once on purpose: LocationMapView renders twice on this page
          (fullscreen navigation plus the layout behind it), so a celebration
          triggered from inside it fired twice. */}
      <MeetingFlare
        userGeo={nav.userGeo}
        partnerLocation={isCompanionTrip ? nav.partnerLocation : null}
        userAvatar={userAvatar}
        partnerAvatar={partnerAvatar}
      />

      {/* ── Fullscreen navigation overlay ── */}
      {nav.isNavigating && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          {/* Map fills the entire viewport */}
          <div className="relative flex-1">
            {/* The emotion buttons sit on THIS overlay, and the overlay covers the
                map that used to be the only one given the ping props — so every
                tap during a journey drew its bubble on a map nobody could see.
                Both directions were silent: your own tap showed nothing, and the
                partner's ping arrived over SSE with nowhere to land. */}
            <LocationMapView
              pins={pins}
              routeGeometry={routeGeometry}
              legGeometries={legGeometries}
              currentLegIndex={currentLegIndex}
              partnerRouteGeometry={partnerRouteGeometry}
              selectedId={selectedId}
              focusGeo={focusGeo}
              draftGeo={draftGeo}
              onCenterChange={setMapCenter}
              userAccuracyM={nav.accuracyM}
              userGeo={shownUser}
              partnerLocation={partnerPin}
              partnerPingAction={navInvites.partnerPingAction}
              userPingAction={nav.userPingAction}
              followGeo={nav.snappedGeo ?? nav.userGeo}
              heading={shownHeading}
              userAvatar={userAvatar}
              partnerAvatar={partnerAvatar}
              partnerName={partnerName}
              onSelect={setSelectedId}
              className="min-h-0 rounded-none border-0 shadow-none"
            />

            {/* ── Navigation HUD: distance + ETA + Speed ── */}
            <div
              className="absolute inset-x-0 top-0 flex items-center justify-center p-3"
              style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
            >
              <div className="flex w-full max-w-md flex-col items-center gap-2">
                {/*
                  The next turn, above everything else on the screen.

                  Deliberately the largest thing in the HUD: while riding, "which
                  way at the next junction" is the only question, and the trip
                  totals underneath are reference. The distance sits in its own
                  column so it can be read without reading the sentence, and the
                  arrow is readable without reading either.
                */}
                {turn.next && turn.metres != null && (
                  <div className="flex w-full items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-xl backdrop-blur-sm">
                    <ManeuverArrowIcon
                      arrow={maneuverArrow(turn.next.type)}
                      className={cn(
                        "h-9 w-9 shrink-0",
                        turn.metres <= 40 ? "text-accent" : "text-slate-700",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold leading-tight text-slate-900">
                        {maneuverLabel(turn.next)}
                      </p>
                      <p className="text-xs font-medium text-muted-foreground">
                        {turn.metres <= 40 ? "Ngay bây giờ" : `còn ${fmtMetresVi(turn.metres)}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setVoiceEnabled(!voiceOn);
                        setVoiceOn(!voiceOn);
                      }}
                      aria-label={voiceOn ? "Tắt giọng chỉ đường" : "Bật giọng chỉ đường"}
                      className="text-muted-foreground hover:bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors"
                    >
                      {voiceOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                    </button>
                  </div>
                )}
                <div className="flex rounded-2xl bg-white/90 shadow-lg backdrop-blur-sm overflow-hidden divide-x divide-border">
                  {/* YOU */}
                  <div className="flex flex-col px-2.5 py-2 sm:px-4 bg-blue-50/50 relative flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider shrink-0">Bạn</span>
                      {/* Own connection/GPS health takes priority over the weather chip. */}
                      {nav.isOffline ? (
                        <div className="text-[9px] font-semibold text-white bg-red-500 px-1 rounded-full flex items-center gap-0.5 shrink-0 animate-pulse leading-tight py-0.5">
                          <WifiOff className="h-2.5 w-2.5" /> Mất mạng
                        </div>
                      ) : nav.gpsLost ? (
                        <div className="text-[9px] font-semibold text-amber-900 bg-amber-200 border border-amber-300 px-1 rounded-full flex items-center gap-0.5 shrink-0 animate-pulse leading-tight py-0.5">
                          <LocateOff className="h-2.5 w-2.5" /> GPS
                        </div>
                      ) : weather ? (
                        <div className="text-[9px] font-medium text-blue-800/60 bg-blue-100/50 px-1 rounded-full flex items-center gap-0.5 shrink-0 leading-tight py-0.5">
                          ⛅ {weather.temp}°
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                      <div className="flex items-center gap-1">
                        <Route className="h-3 w-3 text-blue-500 shrink-0" />
                        <span className="text-xs font-semibold whitespace-nowrap">{fmtDistance(displayDistance)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-blue-500 shrink-0" />
                        <span className="text-xs font-semibold whitespace-nowrap">{fmtDuration(displayDuration)}</span>
                      </div>
                    </div>
                  </div>

                  {/* PARTNER */}
                  {partnerRouteGeometry != null && (
                    <div className="flex flex-col px-2.5 py-2 sm:px-4 bg-rose-50/50 relative flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block leading-tight">
                            {partnerName}
                          </span>
                          {/* Speed hint below label so it doesn't crowd the badge row */}
                          {nav.partnerConnection !== "stale" && nav.partnerLocation?.speedKmH != null && (
                            <span className="text-[9px] font-normal text-rose-400 leading-tight">
                              {nav.partnerLocation.speedKmH < 4 ? "🛑 Đứng" :
                               nav.partnerLocation.speedKmH > 15 ? "🏍️ Vù vù" : "🛵 Tàng"}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                          {/* Partner link health. Both badges are suppressed while OUR
                              own network is down — we can't judge the partner then. */}
                          {nav.isOffline ? null : nav.partnerConnection === "stale" ? (
                            <div className="text-[9px] font-semibold text-white bg-red-500 px-1 rounded-full flex items-center gap-0.5 animate-pulse leading-tight py-0.5">
                              <WifiOff className="h-2.5 w-2.5" /> Mất
                            </div>
                          ) : nav.partnerConnection === "weak" ? (
                            <div className="text-[9px] font-semibold text-amber-900 bg-amber-200 border border-amber-300 px-1 rounded-full flex items-center gap-0.5 leading-tight py-0.5">
                              <Satellite className="h-2.5 w-2.5" /> Yếu
                            </div>
                          ) : null}
                          {nav.partnerLocation?.batteryLevel != null && (
                            <div className={`text-[9px] font-medium px-1 rounded-full flex items-center gap-0.5 leading-tight py-0.5 ${
                              nav.partnerLocation.batteryLevel < 20 ? "text-red-700 bg-red-100/80 animate-pulse border border-red-300" : "text-rose-800/60 bg-rose-100/50"
                            }`}>
                              {nav.partnerLocation.batteryLevel < 20 ? "🪫" : "🔋"} {nav.partnerLocation.batteryLevel}%
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                        <div className="flex items-center gap-1">
                          <Route className="h-3 w-3 text-rose-500 shrink-0" />
                          <span className="text-xs font-semibold whitespace-nowrap">{fmtDistance(partnerRouteDistanceMeters)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-rose-500 shrink-0" />
                          <span className="text-xs font-semibold whitespace-nowrap">{fmtDuration(partnerRouteDurationSeconds)}</span>
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
                    <span className="animate-bounce">🛑</span> {partnerName} đang dừng xe hoặc kẹt cứng rồi!
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

            {/* Quick Pings — a nudge aimed at someone riding with you. On a
                solo trip there is nobody on the other end, and these sat there
                offering to send one anyway. */}
            {isCompanionTrip && (
            <div className="absolute right-4 top-[60%] flex flex-col items-center gap-2">
               <p className="text-[9px] font-semibold text-white/80 bg-black/30 rounded-full px-2 py-0.5 text-center leading-tight backdrop-blur-sm">Gửi cảm xúc<br/>cho {partnerName}:</p>
               {PING_BUTTONS.map((p) => (
                 <button
                   key={p.action}
                   onClick={() => void sendPing(p.action)}
                   disabled={pingCooling}
                   title={p.label}
                   aria-label={p.label}
                   className={cn(
                     "h-10 w-10 bg-white/90 rounded-full shadow-md hover:bg-muted flex items-center justify-center text-lg transition-all active:scale-90",
                     p.urgent && "border-2 border-rose-400",
                     // The guard refuses a second ping for 2.5s. Showing that
                     // refusal beats the old behaviour, where the button looked
                     // live and simply did nothing.
                     pingCooling && "opacity-40 scale-95",
                   )}
                 >
                   {p.emoji}
                 </button>
               ))}
            </div>
            )}

            {/* Floating stop button — always visible over the map.
                Measured, because the map's own "Về vị trí của tôi" pill sits at
                the bottom too and was landing on top of these. The height is
                not a constant to hard-code: the reroute banner, the leg
                progress row and an error line all come and go from this stack. */}
            <div ref={navDockRef}
                 className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-4"
                 style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
            >
              {/* Multi-leg progress + per-leg arrival prompt */}
              {legGeometries && (
                <>
                  <div className="flex items-center gap-1.5 bg-white/90 rounded-full px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-md backdrop-blur-sm">
                    {legGeometries.map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-2 w-2 rounded-full transition-all",
                          i < currentLegIndex
                            ? "bg-emerald-400"
                            : i === currentLegIndex
                              ? "bg-blue-500 scale-125"
                              : "bg-slate-300",
                        )}
                      />
                    ))}
                    <span className="ml-1">Chặng {currentLegIndex + 1}/{legGeometries.length}</span>
                  </div>
                  {legArrived && (
                    <div className="w-full max-w-sm flex flex-col items-center gap-2 rounded-2xl border border-emerald-100 bg-white px-4 py-3 shadow-xl animate-in fade-in slide-in-from-bottom-4">
                      <p className="text-center text-sm font-semibold text-slate-800">
                        {currentLegIndex + 1 >= legGeometries.length
                          ? "Đã tới đích cuối cùng 🎉"
                          : `Đã tới điểm dừng ${currentLegIndex + 1}! Mình đi tiếp chặng ${currentLegIndex + 2} nha 🛵`}
                      </p>
                      <Button
                        className="w-full gap-2 bg-emerald-500 text-white hover:bg-emerald-600"
                        onClick={handleAdvanceLeg}
                      >
                        {currentLegIndex + 1 >= legGeometries.length
                          ? "Hoàn tất chuyến đi"
                          : `Bắt đầu chặng ${currentLegIndex + 2} ▶`}
                      </Button>
                    </div>
                  )}
                </>
              )}
              {legMessage && (
                <p className="bg-emerald-500 text-white rounded-full px-4 py-1.5 text-sm font-semibold shadow-lg">
                  {legMessage}
                </p>
              )}
              {(routeError || nav.error) && (
                <p className="bg-black/60 text-destructive rounded-lg px-3 py-1.5 text-xs backdrop-blur-sm">
                  {routeError ?? nav.error}
                </p>
              )}
              <div className="flex w-full max-w-sm gap-2">
                {miniWindow.supported && (
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={miniWindow.active ? "Đóng khung nhỏ" : "Thu nhỏ thành khung nổi"}
                    title={miniWindow.active ? "Đóng khung nhỏ" : "Thu nhỏ thành khung nổi"}
                    className="bg-white/90 shadow-lg backdrop-blur-sm"
                    onClick={() => void (miniWindow.active ? miniWindow.close() : miniWindow.open())}
                  >
                    <PictureInPicture2 className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1 gap-2 bg-white/90 shadow-lg backdrop-blur-sm"
                  onClick={pauseTrip}
                >
                  <Pause className="h-4 w-4" /> Tạm dừng
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2 text-destructive border-destructive/30 hover:bg-destructive-soft bg-white/90 shadow-lg backdrop-blur-sm"
                  onClick={() => setShowEndConfirm(true)}
                >
                  <Square className="h-4 w-4" /> Kết thúc
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/*
        The map is a layer behind the whole page, not a child of the tool
        column, and it has to be written that way.

        It used to live inside that column. Folding the column away then took
        the map with it — and giving the column `max-w-0` instead left the map
        `position: fixed; inset: 0` resolving to a 0x0 box, so the page went
        blank either way. Out here nothing about the column can reach it.
      */}
      {!nav.isNavigating && (
              <div
                id="map-view"
                className="fixed inset-0 z-0"
              >
              <LocationMapView
                pins={pins}
                routeGeometry={routeGeometry}
                legGeometries={legGeometries}
                currentLegIndex={currentLegIndex}
                partnerRouteGeometry={partnerRouteGeometry}
                selectedId={selectedId}
                focusGeo={focusGeo}
                draftGeo={draftGeo}
                onCenterChange={setMapCenter}
                userAccuracyM={nav.accuracyM}
                userGeo={liveUser}
                partnerLocation={partnerPin}
                partnerPingAction={navInvites.partnerPingAction}
                userPingAction={nav.userPingAction}
                followGeo={nav.isNavigating ? (nav.snappedGeo ?? nav.userGeo) : null}
                heading={nav.isNavigating ? shownHeading : null}
                userAvatar={userAvatar}
                partnerAvatar={partnerAvatar}
              partnerName={partnerName}
                  onSelect={setSelectedId}
                onMapClick={handleMapClick}
              />
            </div>
      )}

      {/* The way back to the tools once the column has been folded away.
          Kept mounted and faded in behind the column's exit — appearing at full
          opacity the instant the button was pressed put two things on screen at
          once and read as the flicker that starts the whole collapse. */}
      {!nav.isNavigating && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          aria-label="Mở bảng điều khiển"
          title="Mở bảng điều khiển"
          tabIndex={panelOpen ? -1 : undefined}
          aria-hidden={panelOpen || undefined}
          className={cn(
            // Clears the sidebar, which is 7rem collapsed and 18rem open —
            // the same measure MainWrapper pads by. This used to offset by
            // var(--map-panel-left), a variable defined nowhere, so it always
            // took the 7rem fallback and sat on top of an open sidebar.
            "border-border bg-card/90 hover:bg-card fixed top-6 z-40 hidden h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium shadow-lg backdrop-blur-xl lg:inline-flex",
            "transition-[opacity,transform,background-color] duration-[380ms] [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
            panelOpen
              ? "pointer-events-none -translate-x-3 opacity-0"
              : "translate-x-0 opacity-100 [transition-delay:120ms]",
            sidebarCollapsed ? "left-[8rem]" : "left-[19rem]",
          )}
        >
          <PanelLeftOpen className="h-4 w-4" />
          Bảng điều khiển
        </button>
      )}

      {/* ── Normal page layout ── */}
      {/*
        Desktop follows the phone here: the map is the page, laid full-bleed
        underneath, and the tools float on top of it in one column.

        It used to be a 1400px page with a tinted banner across the top and the
        map boxed into a grid cell — the chrome was the loudest thing on screen
        and the map, which is the entire point of the screen, read as a widget
        inside it. One column also means the search, the filters and the list
        are the same objects at every width instead of two arrangements to keep
        in step.
      */}
      <div
        className={cn(
          "mx-auto w-full max-w-[1400px] px-4 pt-2 pb-6 md:px-[30px]",
          "lg:mx-0 lg:flex lg:h-[100dvh] lg:flex-col lg:overflow-hidden lg:px-4 lg:pb-4 lg:pt-4",
          // 21rem, not 27: next to a 288px app sidebar the wider column left
          // less than half the screen for the map.
          "lg:max-w-[21rem] xl:max-w-[23rem]",
          /*
           * Collapsing slides and fades the column; it does not take it apart.
           *
           * It used to set max-w-0 on this element and display:none on each
           * block inside, which meant the whole layout was torn down and
           * rebuilt: it snapped instead of animating, and reopening
           * recomputed everything at whatever width the animation was
           * passing through, so the panel came back arranged differently
           * from how it started.
           *
           * Nothing needs to be removed. The map is fixed and full-bleed, so
           * this column has no background of its own — once the tools are
           * transparent and out of the way, the map is all there is.
           */
          /*
           * One motion, not two.
           *
           * `ease-out` front-loads: nearly all of a 24px slide is spent in the
           * first third of the duration, so the column appeared to jump left
           * and then sit there fading. A decelerating curve over a longer
           * travel makes the move readable, and holding opacity back until the
           * column is already moving keeps the fade from finishing first and
           * leaving an invisible thing still sliding.
           */
          "lg:transition-[opacity,transform] lg:duration-[380ms] lg:[transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
          "lg:[transition-delay:0ms,60ms] lg:will-change-[opacity,transform] motion-reduce:lg:transition-none",
          !panelOpen && "lg:pointer-events-none lg:-translate-x-10 lg:opacity-0",
        )}
      >
      {/* Action bar stays pinned; only the cards below scroll under it. */}
      {/* Mobile: single row — utility buttons left, + Thêm right.
          Desktop: title row, then utility row with Thu gọn right-aligned. */}
      <div
        className={cn(
          "sticky top-2 z-40 mb-2 flex shrink-0 flex-col gap-y-2 rounded-2xl border border-border bg-card/90 px-3 py-2 shadow-lg backdrop-blur-xl sm:mb-4 sm:px-4 sm:py-3 lg:static lg:mb-2 lg:py-2",
        )}
      >
        {/* Desktop: title + Thu gọn on the first row */}
        <div className="hidden lg:flex lg:items-center lg:gap-2">
          <h1 className="text-accent min-w-0 flex-shrink truncate text-base font-semibold lg:flex-1">
            Bản đồ ăn chơi
          </h1>
        </div>
        {/* All action buttons on one row.
            Mobile: utility buttons left, + Thêm right.
            Desktop: utility buttons left, + Thêm & Thu gọn right. */}
        <div className="flex min-w-0 items-center gap-2">
          {/* Left group: filter/utility buttons */}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {hasTwoMembers && (
              <Button
                variant="outline"
                className={cn(
                  "border-[var(--accent)]/30 text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all gap-1.5 h-9 shrink-0 px-0 w-9 sm:w-auto sm:px-3 lg:w-9 lg:px-0",
                  isFindingMidpoint && "opacity-50 pointer-events-none"
                )}
                onClick={handleFindMidpoint}
                title={nav.partnerLocation ? "Tìm điểm hẹn ở giữa" : `Cần vị trí của ${partnerName} trước`}
              >
                {isFindingMidpoint ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPinned className="h-4 w-4" />
                )}
                <span className="hidden text-sm font-medium sm:inline lg:hidden">Gặp ở giữa</span>
              </Button>
            )}
            <a
              href="/wheel"
              aria-label="Hôm nay ăn gì?"
              title="Hôm nay ăn gì?"
              className="border-border bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border shadow-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[.98]"
            >
              <Utensils className="h-4 w-4" />
            </a>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          {/* Spacer pushes right group to the edge */}
          <div className="flex-1" />
          {/* Right group: + Thêm and Thu gọn */}
          <div className="flex items-center gap-2">
            <Button
              className="h-9 shrink-0 px-3"
              onClick={() => {
                setFormInitial({});
                setFormOpen((o) => !o);
              }}
            >
              {formOpen ? "Đóng" : "+ Thêm"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="hidden h-9 w-9 shrink-0 lg:inline-flex"
              aria-label="Thu gọn bảng điều khiển"
              title="Thu gọn để xem bản đồ"
              onClick={() => setPanelOpen(false)}
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop: map + filters pinned left, list scrolls on the right. */}
      {/* Mobile: filters top, list middle, map bottom */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:gap-3">
        <div className="contents lg:block lg:shrink-0 lg:space-y-2">
          {/* Name search. Sits above the selects because it is the fastest way
              to reach a specific pin once there are more than a screenful. */}
          {/*
            Controls ride on the map rather than stacking above it. The map is
            fixed, and a fixed element paints above static content, so anything
            left in plain flow would be covered by it — `relative z-30` is what
            lifts these back out.

            Deliberately in normal flow rather than fixed at an offset. An
            earlier version pinned this to top-[68px], measured past the app
            header, and forgot the page header that sits between them — the
            search field landed underneath it. Flow already knows where "just
            below the header" is; hard-coding a pixel offset only means being
            wrong when anything above changes height.
          */}
          {/* z-30 at every width. This used to fall back to z-auto on desktop,
              which was fine while the map was a static grid cell there; now the
              map is fixed at all widths and fixed paints above static, so the
              search field simply vanished underneath it. */}
          {/* z-40, above the filter row and the list. All three used to sit at
              z-30, and DOM order decides a tie — so the suggestion dropdown,
              which belongs to the field at the top, opened underneath the row
              below it. */}
          <div className="relative z-40 space-y-2 lg:space-y-2">
            <PlaceSearchBox
              value={queryText}
              onValueChange={setQueryText}
              // GPS first. `mapCenter` is only set once the person actually
              // pans, so a deliberate look at another city still biases there,
              // but the default view no longer speaks for where they are.
              near={liveUser ?? mapCenter}
              myGeo={liveUser}
              filterCount={activeFilterCount}
              filtersOpen={filtersOpen}
              onToggleFilters={() => setFiltersOpen((v) => !v)}
              onPickPlace={(place) => {
                const point = { lat: place.lat, lng: place.lng };
                setFocusGeo(point);
                setDraftGeo(point);
                setDraftHint("exact");
                setFormInitial({
                  name: place.name,
                  geo: point,
                  ...(place.url ? { socialUrl: place.url } : {}),
                });
                setFormOpen(true);
                requestAnimationFrame(() => {
                  document
                    .getElementById("map-view")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                });
              }}
            />

            {draftHint ? (
              <p className="mx-auto mt-1.5 w-fit rounded-lg border border-border bg-card px-2.5 py-1 text-center text-xs text-muted-foreground shadow-sm">
                {draftHint === "approx"
                  ? "Ghim gần đúng — chạm bản đồ để sửa"
                  : "Chạm bản đồ nếu ghim chưa đúng"}
              </p>
            ) : null}
          </div>

          {/*
            Behind the toggle at every width. Three selects held a permanent
            row over the map to say nothing — someone with eight saved places
            has nothing to filter. Desktop used to keep them open on the theory
            that the column had room; it did not. They were two rows of the
            cluster that covered the left of the screen.
          */}
          <div
            className={cn(
              // relative z-30 for the same reason as the search above it: the
              // map is fixed and would otherwise paint straight over this row.
              "relative z-30 gap-2 lg:order-none",
              // The display utilities are emitted only while open. Adding
              // `hidden` next to `lg:grid` does nothing at lg — both set
              // display at the same breakpoint and the cascade, not the order
              // written here, picks the winner. So the row stayed visible on
              // desktop no matter what the toggle said.
              filtersOpen
                ? "flex lg:grid lg:grid-cols-2 [&>*:last-child]:lg:col-span-2"
                : "hidden",
            )}
          >
            <Select
              className="min-w-0 flex-1"
              aria-label="Lọc theo quận"
              value={district}
              onChange={setDistrict}
              options={[
                { value: "", label: "Khu vực" },
                ...districts.map((d) => ({ value: d, label: d })),
              ]}
            searchable
              searchPlaceholder="Tìm khu vực…"
              />
            <Select
              className="min-w-0 flex-1"
              aria-label="Lọc theo danh mục"
              value={category}
              onChange={setCategory}
              options={[
                { value: "", label: "Danh mục" },
                ...categories.map((c) => ({ value: c, label: c })),
              ]}
            />
            <Select
              className="min-w-0 flex-1"
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

          {/* Opens the saved list on desktop. On a phone the sheet handle
              already does this job, so this is desktop-only. */}
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            aria-expanded={listOpen}
            className="border-border bg-card/90 text-foreground hover:bg-card relative z-30 hidden h-9 w-full items-center justify-between rounded-xl border px-3 text-sm font-medium shadow-sm backdrop-blur-xl transition-colors lg:flex"
          >
            <span className="flex items-center gap-2">
              <ListIcon className="h-4 w-4" aria-hidden="true" />
              {(list.data ?? []).length} địa điểm đã lưu
            </span>
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", listOpen && "rotate-180")}
              aria-hidden="true"
            />
          </button>

          {/*
            Sits with the controls, in flow. It used to be a sibling of the map,
            and the map is fixed — so this had no flow position of its own and
            painted straight over the search box on a phone.
          */}
          {/* Only once the stream is up. Until then we have not asked anybody
              anything, and saying they are not there is a guess — which is how
              this line came to be shown to two people who both had the map
              open. */}
          {hasTwoMembers && navInvites.isConnected && !nav.partnerLocation && (
            <p className="text-muted-foreground relative z-30 rounded-lg border border-border bg-card/90 px-3 py-1.5 text-center text-xs leading-snug shadow-sm backdrop-blur-sm">
              {partnerName} chưa mở Bản đồ nên chưa thấy vị trí.
            </p>
          )}

          {/*
            The map is the page, so on a phone it gets the phone. It used to be
            a 288px strip below the list — too small to read and big enough to
            push everything else down, losing on both counts.

            Not rendered while the fullscreen navigation overlay is up. That
            overlay contains its own map, and this one used to keep running
            behind it: two live WebGL contexts on a phone, which is what let a
            single arrival fire two celebrations.
          */}
          {!nav.isNavigating && (
          <div className="lg:order-none lg:space-y-3 lg:pb-0">


          {/* Follow-me controls appear once a route is on the map. */}
          <div className="relative z-30 flex flex-col gap-2">
            {nav.isOffline && (
              <div className="flex self-center items-center gap-2 rounded-full bg-red-500 px-3 py-1.5 text-xs font-medium text-white shadow-md mb-1 animate-in fade-in slide-in-from-bottom-2">
                <WifiOff className="h-3.5 w-3.5" /> Mất kết nối mạng
              </div>
            )}
            {!nav.isOffline && nav.gpsLost && (
              <div className="flex self-center items-center gap-2 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-medium text-white shadow-md mb-1 animate-in fade-in slide-in-from-bottom-2">
                <LocateOff className="h-3.5 w-3.5" /> Mất định vị GPS
              </div>
            )}
            {isRecalculating.current && !nav.isOffline && (
              <div className="flex self-center items-center gap-2 rounded-full bg-yellow-500 px-3 py-1.5 text-xs font-medium text-white shadow-md mb-1 animate-in fade-in slide-in-from-bottom-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tính lại đường...
              </div>
            )}
            {pausedTrip ? (
              /* Trip paused — resume back into nav, or end it for good. */
              <div className="flex gap-2">
                <Button className="flex-1 gap-2" onClick={resumeTrip}>
                  <Play className="h-4 w-4" /> Tiếp tục
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2 text-destructive border-destructive/30 hover:bg-destructive-soft"
                  onClick={() => setShowEndConfirm(true)}
                >
                  <Square className="h-4 w-4" /> Kết thúc
                </Button>
              </div>
            ) : (routeGeometry != null || legGeometries) ? (
              nav.isNavigating ? (
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive-soft w-full gap-2"
                onClick={pauseTrip}
              >
                <Pause className="h-4 w-4" /> Tạm dừng
              </Button>
            ) : hasTwoMembers ? (
              /* Space has 2 members — show choice. Desktop only: on a phone the
                 same choice is a dialog, because here it sits under the sheet. */
              <div className="hidden gap-2 lg:flex">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => {
                    if (!openSoloPlanner()) { enterImmersive(); announceDeparture(); setFocusGeo(null); nav.start(); }
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
                className="hidden w-full gap-2 lg:flex"
                onClick={() => {
                  if (!openSoloPlanner()) { enterImmersive(); announceDeparture(); setFocusGeo(null); nav.start(); }
                }}
              >
                <Play className="h-4 w-4" /> Lên lộ trình
              </Button>
            )) : null}
          </div>
          {(routeError || nav.error) && (
            <p className="relative z-30 text-destructive text-xs">{routeError ?? nav.error}</p>
          )}
          </div>
          )}
        </div>

        {/* On a phone this rides over the map instead of sitting under it, so
            the map keeps the screen and the list is a thumb away. Same element
            on desktop, where it is simply the right-hand column. */}
        <MapSheet
          count={(list.data ?? []).length}
          className={cn("order-2 lg:order-none", !listOpen && "lg:hidden")}
          // No `raiseTo` any more: the add/edit form is its own dialog, so the
          // sheet no longer has to be dragged up to reveal it.
          collapseSignal={sheetCollapseTick}
          expandSignal={sheetExpandTick}
        >
        <div className="space-y-4">
          {list.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : pins.length === 0 ? (
            <EmptyState
              // Only on the genuinely-empty state. A search that found nothing
              // is a different message, and a picture of a full map would
              // contradict it.
              art={debouncedQuery ? undefined : "emptyMap"}
              icon="map-pin"
              title={debouncedQuery ? `Không có chỗ nào khớp “${debouncedQuery}”` : "Chưa có địa điểm nào"}
              subtitle={
                debouncedQuery
                  ? "Dùng nút tra địa chỉ ở trên để xem chỗ này nằm đâu, rồi quyết có lưu hay không."
                  : "Nhấn + Thêm (hoặc chạm lên bản đồ) để lưu quán, café, chỗ hay hẹn nhau…"
              }
              action={{ label: "+ Thêm địa điểm", onClick: () => { setFormInitial({}); setFormOpen(true); } }}
            />
          ) : (
            // One across inside the floating panel: two columns in 27rem left
            // each card ~200px and broke the place names one word per line.
            <StaggerList className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
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
                        {/*
                          Name above, toggle below — at every width, not just on
                          mobile.

                          These cards sit in a two-column grid, so the card is
                          narrow on a desktop too. Putting a fixed 96px control
                          beside the title left a real place name too little
                          room: it could not shrink, so the row pushed the page
                          16px wider than the screen at 1280. Letting the title
                          shrink instead was worse — it collapsed to one word
                          per line. The title simply needs the full width.
                        */}
                        <div className="flex flex-col gap-1">
                          <p className="font-medium leading-tight">{l.name}</p>
                          <button
                            onClick={() => toggle.mutate({ id: l.id })}
                            className={cn(
                              "self-start relative inline-flex items-center w-24 h-[26px] rounded-full border px-2.5 text-xs font-medium transition-all duration-300 hover:scale-[1.03] active:scale-95 shadow-sm overflow-hidden shrink-0",
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
                          {/* A place with no coordinate has no "Chỉ đường", and
                              without saying so the card just looks like one
                              where the option is missing. Naming it also makes
                              the ones saved before the pin-dropping bug was
                              fixed findable, since they are the only records
                              this can be true of. */}
                          {!l.geo && (
                            <span className="text-amber-600 flex items-center gap-0.5 font-medium">
                              <span aria-hidden>·</span>
                              <LocateOff className="h-3 w-3" />
                              Chưa có vị trí
                            </span>
                          )}
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
                          onClick={() => goToLocation(l.id, l.geo, undefined, { askChoice: true })}
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
        </MapSheet>
        </div>
      </div>

      {/* Adding a place is its own dialog now.
          It used to unfold inline above the saved-places list, which meant the
          form and the list fought over the same scroll box, the sticky footer
          and the sheet's stops — and on desktop it pushed the list down every
          time it opened. `hidden` rather than closed while a point is being
          tapped: closing would throw away everything typed so far. */}
      <Modal
        open={formOpen}
        hidden={pickingGeo}
        onClose={() => { setFormOpen(false); setPickingGeo(false); setDraftGeo(null); setDraftHint(null); }}
      >
        <ModalHeader
          title={formInitial?.id ? "Sửa địa điểm" : "Thêm địa điểm"}
          onClose={() => { setFormOpen(false); setPickingGeo(false); setDraftGeo(null); setDraftHint(null); }}
        />
        <LocationForm
          initial={formInitial}
          categories={categories}
          districts={districts}
          onPickOnMap={() => setPickingGeo(true)}
          onDone={() => { setFormOpen(false); setPickingGeo(false); setDraftGeo(null); setDraftHint(null); setSheetExpandTick((n) => n + 1); }}
          onCancel={() => { setFormOpen(false); setPickingGeo(false); setDraftGeo(null); setDraftHint(null); }}
        />
      </Modal>

      {/* While the dialog stands aside, say so — an invisible dialog and a map
          that suddenly accepts taps is otherwise indistinguishable from a bug. */}
      {formOpen && pickingGeo && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[55] flex justify-center px-4">
          <div className="border-border bg-card pointer-events-auto flex items-center gap-3 rounded-full border px-4 py-2 text-sm shadow-lg">
            <span>Chạm lên bản đồ để chọn vị trí</span>
            <button
              type="button"
              onClick={() => setPickingGeo(false)}
              className="text-accent hover:bg-accent-soft focus-visible:ring-ring/50 cursor-pointer rounded-full px-2 py-0.5 font-medium transition-colors outline-none focus-visible:ring-2"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {settingsOpen && (
        <LocationSettingsModal
          initialCategories={configQuery.data?.categories ?? []}
          initialDistricts={configQuery.data?.districts ?? []}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* ── End-trip confirmation (above the full-screen nav overlay) ── */}
      {showEndConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => setShowEndConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-foreground">Kết thúc chuyến đi?</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Bạn chắc chắn muốn kết thúc? Lộ trình hiện tại sẽ bị xoá và không thể tiếp tục lại.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowEndConfirm(false)}>
                Huỷ
              </Button>
              <Button
                className="flex-1 bg-destructive text-white hover:bg-destructive/90"
                onClick={endTrip}
              >
                Kết thúc
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Partner ended the shared trip — ask whether to stop too ── */}
      {navInvites.endedTrip &&
        (nav.isNavigating || pausedTrip || legGeometries || routeGeometry) && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
            role="presentation"
            onClick={() => navInvites.clearEndedTrip()}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-foreground">
                {partnerName} đã kết thúc chuyến đi 💔
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {partnerName} vừa kết thúc chuyến đi đến{" "}
                <span className="font-medium text-foreground">
                  {navInvites.endedTrip.locationName}
                </span>
                . Bạn có muốn dừng luôn không?
              </p>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navInvites.clearEndedTrip()}
                >
                  Vẫn tiếp tục
                </Button>
                <Button
                  className="flex-1 bg-destructive text-white hover:bg-destructive/90"
                  onClick={endTrip}
                >
                  Dừng luôn
                </Button>
              </div>
            </div>
          </div>
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
            role="presentation"
            onClick={() => setShowMidpointModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              className="bg-card w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-[var(--accent)] p-6 text-white text-center relative">
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
                <p className="mt-1 text-sm text-white/85">
                  Đây là các địa điểm đã lưu nằm ngay giữa quãng đường của hai bạn!
                </p>
              </div>

              {/* Fairness ranking. Straight-line distance is the wrong measure
                  whenever the two routes are not symmetric — one bridge or
                  one-way system between the two of you and the point halfway on
                  the map is a short hop for one person and a detour for the
                  other. */}
              <div className="px-6 pt-4">
                {travelRanks ? (
                  (() => {
                    const r = travelRanks[midpointRecommendations[midpointIndex].id];
                    return r ? (
                      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                        <span>Bạn đi <strong className="text-foreground">{Math.round(r.you / 60)} phút</strong></span>
                        <span>·</span>
                        <span>{partnerName} <strong className="text-foreground">{Math.round(r.them / 60)} phút</strong></span>
                        <span>·</span>
                        <span>
                          {r.gap <= 120 ? "gần như bằng nhau" : `lệch ${Math.round(r.gap / 60)} phút`}
                        </span>
                      </div>
                    ) : (
                      <p className="text-center text-xs text-muted-foreground">
                        Không tính được đường tới chỗ này.
                      </p>
                    );
                  })()
                ) : (
                  <button
                    type="button"
                    onClick={handleRankByTravel}
                    disabled={isRanking || !nav.partnerLocation}
                    className="mx-auto flex items-center gap-1.5 rounded-full border border-[var(--accent)]/30 px-3.5 py-1.5 text-xs font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10 disabled:opacity-50"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {isRanking ? "Đang tính…" : "Xếp theo thời gian đi thật"}
                  </button>
                )}
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
                      {/* Say so when a suggestion is closed. The finder falls
                          back to closed places rather than showing nothing, so
                          without this the person would only find out on
                          arrival. */}
                      {midpointRecommendations[midpointIndex].isOpenNow === false ? (
                        <>
                          <span className="text-amber-600">Giờ này đã đóng cửa</span>
                          <span>·</span>
                        </>
                      ) : null}
                      <span>{midpointRecommendations[midpointIndex].district}</span>
                      <span>·</span>
                      <span>{midpointRecommendations[midpointIndex].category}</span>
                    </div>

                    <Button
                      className="w-full mt-4 gap-2 bg-[var(--accent)] hover:opacity-90 shadow-md text-white border-none"
                      disabled={sendInvite.isPending}
                      onClick={() => {
                        const loc = midpointRecommendations[midpointIndex];
                        handleSendCompanionInvite(loc.id, loc.name);
                        setShowMidpointModal(false);
                      }}
                    >
                      {sendInvite.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Users className="h-5 w-5" />}
                      Rủ {partnerName} tới đây!
                    </Button>
                  </motion.div>
                </AnimatePresence>
                
                {/* Carousel Dots */}
                {midpointRecommendations.length > 1 && (
                  <div className="mt-6 flex justify-center gap-1.5">
                    {midpointRecommendations.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`Xem gợi ý ${i + 1}`}
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

      {/* ── Start-of-trip choice, phones only ── */}
      <AnimatePresence>
        {tripChoiceOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            /* z-50, the same tier as the other dialogs here. It has to beat the
               sheet at z-45 and the nav at z-48, which is the whole reason this
               exists. */
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm lg:hidden"
            onClick={() => setTripChoiceOpen(false)}
            role="presentation"
          >
            <motion.div
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 28, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="trip-choice-title"
              className="border-border bg-card mb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] w-full max-w-sm overflow-hidden rounded-3xl border shadow-2xl"
            >
              <div className="relative h-24 overflow-hidden">
                <ToneArt name="mapTreasure" alt="" fill position="center 45%" sizes="384px" />
                <div className="from-card via-card/55 absolute inset-0 bg-gradient-to-t to-transparent" />
              </div>

              <div className="px-5 pb-5 -mt-6 relative">
                <p id="trip-choice-title" className="font-serif text-lg font-semibold leading-snug">
                  {selectedName ? `Đi tới ${selectedName}` : "Bắt đầu đi thôi"}
                </p>
                <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
                  {routePending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang vẽ đường đi…
                    </>
                  ) : routeError ? (
                    <span className="text-destructive">{routeError}</span>
                  ) : routeDistanceMeters != null ? (
                    `Đường đã vẽ xong — ${fmtDistance(routeDistanceMeters)}${routeDurationSeconds != null ? ` · ${fmtDuration(routeDurationSeconds)}` : ""}.`
                  ) : (
                    "Đường đã vẽ xong trên bản đồ."
                  )}
                </p>

                {routeAlternatives.length > 0 && !routePending && !routeError && (
                  <div className="mt-3">
                    <p className="text-muted-foreground mb-1.5 text-xs font-medium">
                      Đường khác:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {routeAlternatives.map((alt, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => chooseAlternative(i)}
                          className="border-border bg-card hover:bg-muted flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                        >
                          <Route className="text-accent h-3.5 w-3.5" />
                          {fmtDuration(alt.durationSeconds)} · {fmtDistance(alt.distanceMeters)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-2.5">
                  {hasTwoMembers && (
                    <Button
                      className="h-12 w-full gap-2"
                      // Nothing to plan a trip around until the route exists.
                      disabled={routePending || !!routeError}
                      onClick={() => {
                        setTripChoiceOpen(false);
                        if (!selectedId) return;
                        const loc = list.data?.find((l) => l.id === selectedId);
                        if (!loc) return;
                        setCompanionLocationId(loc.id);
                        setCompanionLocationName(loc.name);
                        setShowCompanionChoice(true);
                      }}
                    >
                      <Users className="h-4 w-4" /> Đồng hành cùng nhau
                    </Button>
                  )}
                  {/* Planning stops was only ever offered when inviting someone,
                      but a detour on the way is no less useful alone — and a
                      one-member space had no way to plan one at all. */}
                  <Button
                    variant={hasTwoMembers ? "outline" : undefined}
                    className="h-12 w-full gap-2"
                    disabled={routePending || !!routeError}
                    onClick={() => {
                      setTripChoiceOpen(false);
                      if (!openSoloPlanner()) { enterImmersive(); announceDeparture(); setFocusGeo(null); nav.start(); }
                    }}
                  >
                    {hasTwoMembers ? <UserRound className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {hasTwoMembers ? " Đi một mình" : " Lên lộ trình"}
                  </Button>
                  {/* A failed route leaves both actions disabled, so without
                      this the only way forward is to close and start over. */}
                  {routeError && !routePending && (
                    <Button
                      variant="outline"
                      className="h-11 w-full gap-2"
                      onClick={() => {
                        if (!selectedId) return;
                        const loc = list.data?.find((l) => l.id === selectedId);
                        if (loc?.geo) goToLocation(loc.id, loc.geo, undefined, { askChoice: true });
                      }}
                    >
                      <Route className="h-4 w-4" /> Thử vẽ lại đường
                    </Button>
                  )}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground h-10 text-sm"
                    onClick={() => setTripChoiceOpen(false)}
                  >
                    Để xem đường đã
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Solo trip planner ──
          The same numbered route as the go-together dialog, minus the invite:
          you, any stops, the destination. Offered in a one-member space too,
          which previously had no way to plan a stop at all. */}
      <Modal
        open={soloPlanOpen}
        onClose={() => { setSoloPlanOpen(false); setPlannedStops([]); setStopPickerOpen(false); }}
      >
        <ModalHeader
          title="Lên lộ trình cho chuyến đi"
          onClose={() => { setSoloPlanOpen(false); setPlannedStops([]); setStopPickerOpen(false); }}
        />
        <ModalContent className="space-y-4">
          <p className="text-muted-foreground border-border/60 bg-muted/40 rounded-lg border px-3 py-2 text-xs leading-snug">
            Thêm điểm dừng dọc đường nếu muốn — đổ xăng, mua đồ, ghé qua chỗ nào đó. Bỏ trống thì đi thẳng tới đích.
          </p>
          <TripStopPlanner
            stops={plannedStops}
            onChange={setPlannedStops}
            pickerOpen={stopPickerOpen}
            onPickerOpenChange={setStopPickerOpen}
            savedPlaces={list.data ?? []}
            destinationId={companionLocationId}
            destinationName={companionLocationName}
          />
        </ModalContent>
        <ModalFooter>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => { setSoloPlanOpen(false); setPlannedStops([]); setStopPickerOpen(false); }}
          >
            Huỷ
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={() => {
              const destId = companionLocationId;
              const loc = destId ? list.data?.find((l) => l.id === destId) : null;
              setSoloPlanOpen(false);
              setStopPickerOpen(false);
              if (!loc?.geo) return;
              // Only saved stops here: "pick up the other person" belongs to a
              // trip that person has agreed to, which this one is not.
              const waypointGeos = plannedStops
                .filter((st): st is Extract<PlannedStop, { kind: "saved" }> => st.kind === "saved")
                .map((st) => ({ lat: st.lat, lng: st.lng }));
              // Re-draw through the stops, then start — the same two steps an
              // accepted companion trip takes.
              goToLocation(loc.id, loc.geo, waypointGeos.length ? waypointGeos : undefined);
              setPlannedStops([]);
              // Spoken here, inside the tap, without figures: the re-route
              // above has not answered yet and the ones in state are the old
              // route's.
              enterImmersive();
              announceDeparture({ withNumbers: false });
              setAutoStartWhenRouted(true);
            }}
          >
            <Play className="h-4 w-4" />
            {plannedStops.length > 0 ? `Đi qua ${plannedStops.length} điểm dừng` : "Bắt đầu đi"}
          </Button>
        </ModalFooter>
      </Modal>

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
              className="bg-card rounded-2xl shadow-xl max-w-sm w-full flex flex-col max-h-[85vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
            >
              {/* Only the content scrolls; the action buttons stay pinned below. */}
              <div className="space-y-4 overflow-y-auto p-6 flex-1">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 shrink-0 shadow-inner">
                    <Users className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg leading-tight">Lập kế hoạch đi chung</h3>
                    <p className="text-sm text-muted-foreground">Tạo lộ trình cho 2 người</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground bg-muted/40 border border-border/60 rounded-lg px-3 py-2 leading-snug">
                  Lên lộ trình chung: Bạn → (đón {partnerName} / điểm dừng) → Đích. {partnerName} sẽ nhận lời mời và cùng được chỉ đường.
                </p>
                
                <TripStopPlanner
                  stops={plannedStops}
                  onChange={setPlannedStops}
                  pickerOpen={stopPickerOpen}
                  onPickerOpenChange={setStopPickerOpen}
                  savedPlaces={list.data ?? []}
                  destinationId={companionLocationId}
                  destinationName={companionLocationName}
                  partnerLocation={nav.partnerLocation}
                />

                <p className="text-xs text-muted-foreground text-center">
                  {partnerName} sẽ nhận được thông báo lộ trình. Khi đồng ý, cả 2 sẽ cùng thấy nhau trên bản đồ.
                </p>
              </div>
              <div className="flex gap-2 shrink-0 border-t border-border p-4">
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
              <span className="text-sm font-medium flex-1">Đang chờ {partnerName} đồng ý...</span>
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
