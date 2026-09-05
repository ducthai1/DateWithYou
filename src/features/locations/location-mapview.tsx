"use client";

import { useCallback, memo, useEffect, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import Map, { Marker, Source, Layer, AttributionControl, type MapRef } from "react-map-gl/maplibre";
import { VietnamSovereigntyMarkers } from "./vietnam-sovereignty-markers";
import { applyEastSeaLabel } from "./east-sea-label";
import "maplibre-gl/dist/maplibre-gl.css";
import { geodesicCircle, type LatLng } from "@/lib/maps";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { buzz } from "@/lib/haptics";

// OpenFreeMap serves free vector tiles + styles with no API key, no signup, and
// no credit card — unlike Mapbox, which gates tokens behind a payment method.
/*
 * One base map, all day.
 *
 * There was a second one, swapped in from 18:00 to 06:00 — a white map at night
 * is a torch in the face of someone riding a motorbike, so the reasoning stands.
 * What did not stand was the style available to swap to. It carries none of the
 * POI layers this one has, so every shop and landmark name vanished after dark;
 * it publishes its sea label under a different layer name; its motorway cores
 * interpolate to pure black above zoom 6; and nothing pre-warmed it, so dusk
 * arrived as a cold download in the middle of a ride.
 *
 * Recolouring it fixed the colours and none of the rest. Withdrawn until the
 * night map can be this same style under a dark palette, which is the only
 * version of it that keeps the map whole — see the palette and its wiring in
 * commit 30e6902 for the groundwork.
 */
const MAP_STYLE_DAY = "https://tiles.openfreemap.org/styles/liberty";
// Ho Chi Minh City centre.
const DEFAULT_CENTER = { longitude: 106.7009, latitude: 10.7769, zoom: 12 };

/**
 * Open where the map was last looking, not on the default city.
 *
 * Every visit used to start on Saigon: tiles for a city the couple may never
 * have been to were fetched and drawn, and only then did the camera jump to
 * where they actually are and fetch again. Remembering the last centre puts the
 * first tiles requested in the right place, so the first paint is the map they
 * want. Zoom is clamped: a ride ends at zoom 18.5, and opening the app on a
 * single street corner is not a useful start.
 */
const LAST_VIEW_KEY = "vivu.map.lastView";
function readLastView(): typeof DEFAULT_CENTER {
  if (typeof window === "undefined") return DEFAULT_CENTER;
  try {
    const raw = window.localStorage.getItem(LAST_VIEW_KEY);
    if (!raw) return DEFAULT_CENTER;
    const v = JSON.parse(raw) as Partial<typeof DEFAULT_CENTER>;
    if (
      typeof v.longitude !== "number" || typeof v.latitude !== "number" || typeof v.zoom !== "number" ||
      !Number.isFinite(v.longitude) || !Number.isFinite(v.latitude) || !Number.isFinite(v.zoom)
    ) return DEFAULT_CENTER;
    return { longitude: v.longitude, latitude: v.latitude, zoom: Math.min(16, Math.max(10, v.zoom)) };
  } catch {
    return DEFAULT_CENTER;
  }
}
function rememberView(map: { getCenter(): { lng: number; lat: number }; getZoom(): number }) {
  try {
    const c = map.getCenter();
    window.localStorage.setItem(
      LAST_VIEW_KEY,
      JSON.stringify({ longitude: c.lng, latitude: c.lat, zoom: Math.min(16, Math.max(10, map.getZoom())) }),
    );
  } catch {
    /* Storage full or unavailable — the default is still there next time. */
  }
}

export type MapPin = {
  id: string;
  name: string;
  geo: LatLng | null;
  status: "want_to_go" | "visited";
};

// Generates a distinctly different color for coordinates, even if they are very close.
function getPinColor(lat: number, lng: number, status: string): string {
  const val = Math.floor(lat * 111111) * 73856093 ^ Math.floor(lng * 111111) * 19349663;
  const hue = Math.abs(val) % 360;
  // If visited, we make the color darker/less saturated, or just keep it vibrant.
  // We'll keep it vibrant but perhaps a slightly different lightness if we wanted.
  // The user requested distinct colors for each place.
  return `hsl(${hue}, 85%, ${status === "visited" ? "45%" : "60%"})`;
}

function LocationMapViewImpl({
  pins,
  routeGeometry,
  legGeometries,
  currentLegIndex = 0,
  partnerRouteGeometry,
  selectedId,
  focusGeo,
  draftGeo,
  userGeo,
  userAccuracyM,
  partnerLocation,
  partnerPingAction,
  userPingAction,
  followGeo,
  heading,
  userAvatar,
  partnerAvatar,
  partnerName = "Người kia",
  onSelect,
  onMapClick,
  onCenterChange,
  onMapInstance,
  attribution = true,
  className,
}: {
  pins: MapPin[];
  routeGeometry?: unknown;
  /** Per-leg polylines for a multi-stop trip; each drawn in its own colour. */
  legGeometries?: Array<{ geometry: { coordinates: [number, number][] } }> | null;
  /** Index of the leg currently being navigated (earlier legs render dimmed). */
  currentLegIndex?: number;
  partnerRouteGeometry?: unknown;
  selectedId?: string | null;
  focusGeo?: LatLng | null;
  /** A point being confirmed but not saved yet — the address lookup result. */
  draftGeo?: LatLng | null;
  userGeo?: LatLng | null;
  /** Horizontal GPS accuracy in metres, drawn to scale when known. */
  userAccuracyM?: number | null;
  partnerLocation?: { lat: number; lng: number; pingAction?: string | null } | null;
  partnerPingAction?: string | null;
  userPingAction?: string | null;
  followGeo?: LatLng | null;
  /** Device heading in degrees (0 = north). Rotates the map when following. */
  heading?: number | null;
  userAvatar?: string;
  partnerAvatar?: string;
  /** What to call them on the map. Falls back only in a space of one. */
  partnerName?: string;
  onSelect?: (id: string) => void;
  onMapClick?: (geo: LatLng) => void;
  /**
   * Where the map is looking, reported after every move and once on load.
   *
   * Place search needs it. Published guidance is to bias autocomplete by the
   * map's viewport whenever there is a map, and this component was the only
   * thing that knew where that was — so the search box had nothing and fell
   * back to no bias at all, which returns matches from the whole country.
   */
  onCenterChange?: (center: LatLng) => void;
  /** The MapLibre instance once loaded, null on unmount. The floating
   *  navigation window crops its background out of this map. */
  onMapInstance?: (map: import("maplibre-gl").Map | null) => void;
  /**
   * Draw MapLibre's own attribution control. Off for thumbnail-sized maps.
   *
   * The control is `compact`, but compact still means a panel wide enough to
   * read a sentence, and at 168px that sentence covers the entire map. A
   * thumbnail that shows nothing but its own copyright notice is not a map.
   * Callers that turn this off must attribute some other way — the mini dock
   * prints a micro credit line and links to the full map, which carries the
   * control properly.
   */
  attribution?: boolean;
  className?: string;
}) {
  const mapRef = useRef<MapRef>(null);
  useEffect(() => () => onMapInstance?.(null), [onMapInstance]);
  // Read once, at mount — this component is client-only (`ssr: false`).
  const [initialView] = useState(readLastView);

  // Track manual map interactions to suspend auto-tracking
  const [isUserInteracting, setIsUserInteracting] = useState(false);

  /*
   * The meeting celebration used to live here. It was moved to MeetingFlare,
   * mounted once at the page level: this component renders twice on the map
   * page (fullscreen navigation overlay plus the normal layout behind it), so
   * anything triggered from inside it happened twice — two overlays, two
   * confetti bursts, two vibrations.
   */

  // ── QUICK PINGS (EMOTION BUBBLES) ──
  const [globalPing, setGlobalPing] = useState<{ emoji: string; id: number; fromPartner: boolean } | null>(null);
  
  const getPingEmoji = (action: string, isPartner: boolean) => {
    let emoji = "";
    if (action === "HOT") emoji = "🥵 Nóng quá!";
    if (action === "JAM") emoji = "🐌 Kẹt xe cứng ngắc!";
    if (action === "WAIT") emoji = "🥺 Đợi xíu nha!";
    if (action === "HURRY") {
      emoji = "🚨 Rung rinh!";
      if (isPartner) {
        // Urgent, and allowed to fall back to sound: this is the one signal
        // meant to reach someone who is not looking at the screen, and on iOS
        // there is no vibration to fall back on.
        buzz([200, 100, 200, 100, 500], { urgent: true });
      }
    }
    return emoji;
  };

  useEffect(() => {
    // Pings arrive in real time over SSE only. The persisted live-location
    // pingAction is intentionally NOT used as a second source — it lingers across
    // polls and would re-fire the same ping repeatedly. The single always-visible
    // banner below is the only render, so a ping shows exactly once.
    if (!partnerPingAction) return;
    const emoji = getPingEmoji(partnerPingAction, true);
    if (!emoji) return;
    const pingId = Date.now();
    setGlobalPing({ emoji, id: pingId, fromPartner: true });
    setTimeout(() => setGlobalPing((prev) => (prev?.id === pingId ? null : prev)), 4000);
  }, [partnerPingAction]);

  useEffect(() => {
    if (!userPingAction) return;
    const emoji = getPingEmoji(userPingAction, false);
    if (!emoji) return;
    const pingId = Date.now();
    setGlobalPing({ emoji, id: pingId, fromPartner: false });
    setTimeout(() => setGlobalPing((prev) => (prev?.id === pingId ? null : prev)), 4000);
  }, [userPingAction]);

  /*
   * Panning stops the camera following, and it stays stopped.
   *
   * It used to resume by itself after 2 seconds, which made looking ahead on
   * the map impossible: the moment you let go to read the next junction, the
   * camera snapped back to your own dot. Two seconds is shorter than the act it
   * was interrupting. Every map application handles this the same way instead —
   * stop, and offer the way back explicitly — so there is a button, and the
   * person decides when following resumes.
   */
  const handleInteraction = () => {
    setIsUserInteracting(true);
  };
  const recentre = () => {
    setIsUserInteracting(false);
    const target = followGeo ?? userGeo;
    if (target) {
      mapRef.current?.easeTo({
        center: [target.lng, target.lat],
        zoom: 18.5,
        bearing: heading ?? 0,
        pitch: 60,
        duration: 500,
      });
    }
  };

  /*
   * Centre on the first position fix, once.
   *
   * Before this the map opened on a hard-coded default no matter where the
   * person was, which is a poor first impression and also fed the wrong area to
   * place search — everyone got results biased to Saigon. Guarded by a ref so
   * it happens exactly once: after that the view belongs to whoever is panning
   * it, and a later fix must not yank it back.
   */
  /*
   * Centre on the person's own position, once, as soon as the map object exists.
   *
   * Two earlier versions of this both failed, in opposite directions:
   *
   * 1. `mapRef.current?.easeTo(...)` with the once-only flag set BEFORE the
   *    call. The position almost always wins that race — the on-arrival lookup
   *    accepts a fix up to five minutes old, so it answers from cache
   *    immediately while MapLibre still has a bundle, a style, a sprite and six
   *    font files to fetch — so the ref was null, the optional chaining
   *    swallowed the call, the flag was spent, and the map stayed on its
   *    default centre for the session. Anyone not in Saigon opened the app
   *    looking at Saigon with their location switched on.
   *
   * 2. Gating on MapLibre's `load` event. That fires only once the STYLE has
   *    loaded, so a slow or failed tile server meant the camera never moved at
   *    all — trading a race for a dependency on the network.
   *
   * What it actually needs is the map object, which react-map-gl hands over on
   * mount, long before any style work. Camera moves do not need a loaded style.
   * So this waits for the ref and nothing else, and marks itself done only
   * after the camera has been told to move.
   */
  const centredOnFirstFix = useRef(false);
  useEffect(() => {
    if (centredOnFirstFix.current || !userGeo || followGeo || focusGeo) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const centre = () => {
      if (cancelled || centredOnFirstFix.current) return;
      const map = mapRef.current;
      if (!map) {
        timer = setTimeout(centre, 200);
        return;
      }
      centredOnFirstFix.current = true;
      map.easeTo({ center: [userGeo.lng, userGeo.lat], zoom: 14, duration: 700 });
    };
    centre();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [userGeo, followGeo, focusGeo]);

  // Follow mode: keep the live position centred as the user moves.
  // When heading is available, rotate the map so "up" = direction of travel.
  useEffect(() => {
    if (followGeo && !isUserInteracting) {
      mapRef.current?.easeTo({
        center: [followGeo.lng, followGeo.lat],
        zoom: 18.5,
        bearing: heading ?? 0,
        pitch: 60,       // tilted 3-D perspective for navigation feel
        duration: 600,
      });
    }
  }, [followGeo, heading, isUserInteracting]);

  // In-app "Chỉ đường": glide the map to the chosen pin instead of leaving the app.
  useEffect(() => {
    if (focusGeo) {
      mapRef.current?.flyTo({
        center: [focusGeo.lng, focusGeo.lat],
        zoom: 15,
        bearing: 0,
        pitch: 0,
        duration: 800,
      });
    }
  }, [focusGeo]);

  // When a route is drawn, frame the whole line so both the user's location and
  // the destination are visible at once.
  useEffect(() => {
    const coords = (routeGeometry as { coordinates?: [number, number][] } | null)
      ?.coordinates;
    if (!coords?.length) return;
    let minLng = Infinity,
      minLat = Infinity,
      maxLng = -Infinity,
      maxLat = -Infinity;
    for (const [lng, lat] of coords) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    mapRef.current?.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 56, duration: 900, maxZoom: 16 },
    );
  }, [routeGeometry]);

  // Frame all legs once when a multi-stop trip is first drawn. Keyed on leg
  // count (not array identity) so re-routing a single leg never re-frames the
  // map and yanks the view away while the user is riding.
  /** Past this many pins, labels stop competing for the same few pixels. */
  const crowded = pins.length > 8;

  const legCount = legGeometries?.length ?? 0;
  useEffect(() => {
    if (!legGeometries?.length) return;
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const leg of legGeometries) {
      for (const [lng, lat] of leg.geometry.coordinates) {
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }
    if (minLng === Infinity) return;
    mapRef.current?.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding: 56, duration: 900, maxZoom: 16 },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legCount]);

  /*
   * Nothing is shown until the first frame is complete.
   *
   * MapLibre paints tiles the moment each one arrives, so the map used to
   * assemble itself in front of the person — grey, then a patch of streets,
   * then another, then labels. Waiting for `idle`, which is the map saying it
   * has finished everything the current view needs, turns that into one clean
   * appearance.
   *
   * The timer is the safety net: a tile that never arrives must not leave the
   * screen blank forever, so after 6s it is shown in whatever state it reached.
   */
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 6000);
    return () => clearTimeout(t);
  }, []);

  /*
   * Applied on every style event, not once at startup: MapLibre replaces the
   * whole style object when it reloads one, and anything set on the previous
   * one goes with it.
   */
  /*
   * Whether the partner's name is pinned open.
   *
   * Hover cannot be the only way in: a tap has no hover, so on a phone the
   * label existed and was unreachable. It closes itself after a few seconds so
   * a name does not sit over the map for the rest of the ride.
   */
  const [partnerNameShown, setPartnerNameShown] = useState(false);
  useEffect(() => {
    if (!partnerNameShown) return;
    const t = setTimeout(() => setPartnerNameShown(false), 4000);
    return () => clearTimeout(t);
  }, [partnerNameShown]);

  const dressStyle = useCallback((target: unknown) => {
    applyEastSeaLabel(target as Parameters<typeof applyEastSeaLabel>[0]);
  }, []);

  return (
    <div 
      className={cn("relative h-full min-h-[280px] overflow-hidden rounded-xl border border-border bg-card shadow-sm", className)}
      onPointerDownCapture={handleInteraction}
      onWheelCapture={handleInteraction}
      onTouchStartCapture={handleInteraction}
    >
      {followGeo && isUserInteracting && (
        <button
          type="button"
          onClick={recentre}
          /* Rides above whatever the page has docked at the bottom edge — the
             pause/end controls during a trip, nothing at all otherwise. Was a
             flat bottom-4, which put it straight through those buttons. */
          style={{ bottom: "calc(var(--nav-dock-h, 0px) + 1rem)" }}
          className="border-border bg-card/95 text-foreground absolute left-1/2 z-[3] flex -translate-x-1/2 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold shadow-xl backdrop-blur-sm"
        >
          <LocateFixed className="text-accent h-4 w-4" />
          Về vị trí của tôi
        </button>
      )}

      <div
        aria-hidden="true"
        className={cn(
          "bg-muted pointer-events-none absolute inset-0 z-[1] transition-opacity duration-500",
          drawn ? "opacity-0" : "opacity-100",
        )}
      />
      <Map
        ref={mapRef}
        initialViewState={initialView}
        onStyleData={(e) => dressStyle(e.target)}
        onLoad={(e) => {
          // Deliberately does NOT report a centre. The map opens on a fixed
          // default (Saigon), and reporting that as "where the person is
          // looking" made it the search bias for everyone — so anyone opening
          // the app from another city searched Saigon by default and got
          // results hundreds of kilometres away while the same chain stood
          // around the corner. Until the map is actually moved, the live GPS
          // fix is the better answer, and the page falls back to it.

          // The sea carries its Vietnamese name, in the position the base map
          // chose for that label rather than a plate guessing at it.
          dressStyle(e.target);
          onMapInstance?.(e.target);
        }}
        onIdle={() => setDrawn(true)}
        onMoveEnd={(e) => {
          // Every move, programmatic ones included: following a ride is exactly
          // what puts the camera where the couple actually is.
          rememberView(e.target);
          // The search bias, though, only from a move the person made. Flying
          // to a pin, following a live position, fitting a route — letting
          // those set the bias would put it back where it was.
          if (!e.originalEvent) return;
          const c = e.target.getCenter();
          onCenterChange?.({ lat: c.lat, lng: c.lng });
        }}
        mapStyle={MAP_STYLE_DAY}
        attributionControl={false}
        onClick={(e) =>
          onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng })
        }
      >
        {attribution ? <AttributionControl compact={true} position="top-right" /> : null}

        {/* The point being confirmed.
            The address lookup deliberately does not save what it finds — it
            shows it and asks. That only works if there is something to look at,
            and there was not: the map flew to the coordinate and showed bare
            ground while the form filled in a latitude and longitude, which
            tells nobody anything. This is drawn differently from a saved pin on
            purpose, because it is not one yet. */}
        {draftGeo ? (
          <Marker longitude={draftGeo.lng} latitude={draftGeo.lat} anchor="bottom">
            <div className="relative flex flex-col items-center">
              <span className="mb-1 whitespace-nowrap rounded-full bg-[#c2693f] px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg">
                Chỗ vừa tìm — chưa lưu
              </span>
              <span className="absolute bottom-1 h-10 w-10 animate-ping rounded-full bg-[#c2693f]/30" />
              <svg width="30" height="38" viewBox="0 0 24 30" className="relative drop-shadow-lg">
                <path
                  d="M12 0C5.4 0 0 5.4 0 12c0 8.2 12 18 12 18s12-9.8 12-18c0-6.6-5.4-12-12-12z"
                  fill="#c2693f"
                />
                <circle cx="12" cy="12" r="4.5" fill="#fff" />
              </svg>
            </div>
          </Marker>
        ) : null}

        {/* GPS accuracy, to scale.
            A pixel-radius circle would mean a different distance at every zoom
            level, so this is a real polygon and the map projects it — the drawn
            radius keeps matching the number the device reported. Only drawn
            when the reading is loose enough to matter: a 5m circle at city zoom
            is a dot, and rendering it suggests a precision claim nobody made. */}
        {userGeo && userAccuracyM != null && userAccuracyM >= 15 ? (
          <Source
            id="gps-accuracy"
            type="geojson"
            data={{
              type: "Feature",
              properties: {},
              geometry: {
                type: "Polygon",
                coordinates: [geodesicCircle(userGeo, userAccuracyM)],
              },
            }}
          >
            <Layer
              id="gps-accuracy-fill"
              type="fill"
              paint={{ "fill-color": "#3b82f6", "fill-opacity": 0.12 }}
            />
            <Layer
              id="gps-accuracy-line"
              type="line"
              paint={{ "line-color": "#3b82f6", "line-opacity": 0.35, "line-width": 1 }}
            />
          </Source>
        ) : null}

        {/* ── GLOBAL PING OVERLAY (Always visible even if map is scrolled away) ── */}
        <AnimatePresence>
          {globalPing && (
            <motion.div
              key={globalPing.id}
              initial={{ opacity: 0, scale: 0.5, y: globalPing.fromPartner ? -20 : 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: globalPing.fromPartner ? -20 : 20 }}
              transition={{ type: "spring", damping: 15, stiffness: 300 }}
              className={cn(
                "absolute left-1/2 -translate-x-1/2 z-50 rounded-full px-5 py-2.5 text-base md:text-lg font-bold shadow-2xl border-2 backdrop-blur-md flex items-center gap-2",
                globalPing.fromPartner ? "top-4 bg-white/95 border-rose-200 text-rose-600" : "bottom-4 bg-white/95 border-blue-200 text-blue-600"
              )}
            >
              <span className="text-2xl">{globalPing.emoji.split(' ')[0]}</span>
              <span>{globalPing.emoji.split(' ').slice(1).join(' ')}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {pins
          .filter((p) => p.geo)
          .map((p) => (
            <Marker
              key={p.id}
              longitude={p.geo!.lng}
              latitude={p.geo!.lat}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onSelect?.(p.id);
              }}
            >
              <div className="group relative flex cursor-pointer flex-col items-center">
                {/*
                  Name label, capped and truncated.

                  It used to be whitespace-nowrap with no width limit, so a real
                  place name — "Quán Cà Phê Sân Vườn Hoa Giấy Sài Gòn Xưa Chi
                  Nhánh Nguyễn Thị Minh Khai Quận Ba" — became a pill wider than
                  a phone. With a dozen saved places the labels stacked over each
                  other and ran off both edges; the map was unreadable.

                  On a crowded map the labels also step back and appear on
                  demand, which is what pin-dense maps do: names for the pin you
                  are pointing at, dots for the rest. pointer-events-none so an
                  overlapping label can never swallow a tap meant for a dot.
                */}
                <span
                  className={cn(
                    "pointer-events-none mb-1 truncate rounded-md bg-white/95 px-1.5 py-0.5 text-[10px] font-bold shadow-sm backdrop-blur-sm transition-all duration-200",
                    selectedId === p.id ? "max-w-[11rem]" : "max-w-[7.5rem]",
                    crowded && selectedId !== p.id && "opacity-0 group-hover:opacity-100",
                    selectedId !== p.id && "group-hover:scale-110 group-hover:text-black",
                    selectedId === p.id ? "scale-110 text-black z-10 ring-1 ring-border" : "text-muted-foreground scale-100"
                  )}
                >
                  {p.name}
                </span>

                {/* Dot */}
                <span
                  className={cn(
                    "block h-4 w-4 rounded-full border-2 border-white shadow transition-all duration-200",
                    selectedId === p.id ? "scale-125 ring-2 ring-black/20 ring-offset-1" : "group-hover:scale-110"
                  )}
                  style={{ backgroundColor: getPinColor(p.geo!.lat, p.geo!.lng, p.status) }}
                  title={p.name}
                />
              </div>
            </Marker>
          ))}

        {/* No trail of where you have been.
            It was drawn as an 8px indigo line at full opacity, over the top of
            the route it belonged to, so the two blues fought each other and the
            one that mattered — where to go next — was the fainter of the pair.
            Where you have already been is the one thing a person navigating does
            not need told. */}

        {userGeo && (
          <Marker
            longitude={userGeo.lng}
            latitude={userGeo.lat}
            // Rotate the marker itself so the arrow points in travel direction.
            // The map rotates too, but the marker must stay pointing "up" relative
            // to the map — so we counter-rotate by subtracting the map bearing.
            rotation={0}
            style={{ zIndex: 10 }}
          >
            {heading != null ? (
              /* Directional arrow when heading is known */
              <div className="relative flex items-center justify-center">
                {/* Pulse marking your own position. Deliberately not called
                    an accuracy halo: it is a fixed size and does not scale
                    with the measured accuracy, so it would imply a precision
                    it is not reporting. Actual accuracy drives the weak-GPS
                    state in use-live-navigation instead. */}
                <span className="absolute h-16 w-16 animate-ping rounded-full bg-blue-400/30" />
                
                {/* Direction cone */}
                <svg
                  width="56"
                  height="56"
                  viewBox="0 0 36 36"
                  fill="none"
                  className="drop-shadow-lg absolute"
                >
                  <path
                    d="M18 2 L26 18 L18 14 L10 18 Z"
                    fill="#3b82f6"
                    fillOpacity="0.9"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
                
                {/* Centre avatar or dot */}
                {userAvatar ? (
                  <img src={userAvatar} alt="Bạn" className="relative z-10 h-8 w-8 rounded-full border-[2.5px] border-white object-cover shadow-sm bg-muted" />
                ) : (
                  <circle cx="18" cy="16" r="4" fill="#3b82f6" stroke="white" strokeWidth="2" className="relative z-10" />
                )}
              </div>
            ) : (
              /* Simple avatar or dot when heading is unknown */
              <div className="relative flex items-center justify-center">
                {userAvatar ? (
                  <img src={userAvatar} alt="Bạn" className="h-9 w-9 rounded-full border-[2.5px] border-white object-cover shadow-md ring-4 ring-blue-500/30 bg-muted" />
                ) : (
                  <span
                    className="block h-5 w-5 rounded-full border-[2.5px] border-white bg-blue-500 shadow ring-4 ring-blue-500/30"
                    title="Vị trí của bạn"
                  />
                )}
              </div>
            )}
          </Marker>
        )}

        {partnerLocation && (
          <Marker
            longitude={partnerLocation.lng}
            latitude={partnerLocation.lat}
            style={{ zIndex: 9 }}
          >
            {/* Carries the position it is drawn at, so where the other person
                is shown can be read off the page rather than inferred from a
                map transform. */}
            {/* A button, because on a phone there is no hover to reveal the
                name with — the label was reachable with a mouse and by no other
                means. Tapping toggles it; the mouse still gets it on hover. */}
            <button
              type="button"
              data-partner-pin=""
              data-lat={partnerLocation.lat}
              data-lng={partnerLocation.lng}
              aria-label={`Vị trí của ${partnerName}`}
              aria-pressed={partnerNameShown}
              onClick={(e) => {
                e.stopPropagation();
                setPartnerNameShown((v) => !v);
              }}
              className="group relative flex items-center justify-center"
            >
              <span
                className={cn(
                  "absolute -top-6 whitespace-nowrap rounded-md bg-white/95 px-1.5 py-0.5 text-[10px] font-bold shadow-sm backdrop-blur-sm transition-all duration-200",
                  "group-hover:-translate-y-1 group-hover:opacity-100",
                  partnerNameShown ? "-translate-y-1 opacity-100" : "opacity-0",
                )}
              >
                {partnerName}
              </span>
              <span className="absolute h-12 w-12 animate-ping rounded-full bg-rose-400/30" />
              {partnerAvatar ? (
                <img src={partnerAvatar} alt={partnerName} className="relative z-10 h-8 w-8 rounded-full border-[2.5px] border-white object-cover shadow-md ring-4 ring-rose-500/30 bg-muted" />
              ) : (
                <span className="relative z-10 block h-5 w-5 rounded-full border-[2.5px] border-white bg-rose-500 shadow ring-4 ring-rose-500/30" />
              )}
            </button>
          </Marker>
        )}

        {/* Vietnam's sovereignty over Hoàng Sa and Trường Sa, stated by the
            product rather than left to whoever drew the base tiles. Not saved
            places — they belong to no space and no list. */}
        <VietnamSovereigntyMarkers />

        {/* CROW FLIES LINE (DASHED) BETWEEN PARTNERS WHEN NO ROUTE IS SELECTED */}
        {!routeGeometry && userGeo && partnerLocation && (
          <Source
            id="partner-distance"
            type="geojson"
            data={{
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: [
                  [userGeo.lng, userGeo.lat],
                  [partnerLocation.lng, partnerLocation.lat],
                ],
              } as never,
            }}
          >
            <Layer
              id="partner-distance-line"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": "#a8a29e", // stone-400
                "line-width": 2,
                "line-dasharray": [2, 4], // Dashed pattern
              }}
            />
          </Source>
        )}

        {/* PARTNER'S ROUTE (PINK) */}
        {partnerRouteGeometry != null && (
          <Source
            id="partner-route"
            type="geojson"
            data={{ type: "Feature", properties: {}, geometry: partnerRouteGeometry as never }}
          >
            <Layer
              id="partner-route-line"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": "#c2693f", "line-width": 8, "line-opacity": 0.6 }} // rose-500
            />
          </Source>
        )}

        {/* MULTI-STOP TRIP. Upcoming/done legs are drawn as faint dashed greys
            — just enough to preview the shape — while the leg currently being
            ridden is rendered last (on top), bold, with a soft pastel gradient
            flowing along it so it's unmistakably the active one. */}
        {legGeometries?.length ? (
          <>
            {legGeometries.map((leg, i) => {
              if (i === currentLegIndex) return null; // active leg drawn below
              const done = i < currentLegIndex;
              return (
                <Source
                  key={`leg-${i}`}
                  id={`leg-${i}`}
                  type="geojson"
                  data={{
                    type: "Feature",
                    properties: {},
                    geometry: { type: "LineString", coordinates: leg.geometry.coordinates } as never,
                  }}
                >
                  <Layer
                    id={`leg-${i}-line`}
                    type="line"
                    layout={{ "line-cap": "round", "line-join": "round" }}
                    paint={{
                      "line-color": done ? "#cbd5e1" : "#94a3b8", // slate: done paler than upcoming
                      "line-width": 4,
                      "line-opacity": done ? 0.35 : 0.55,
                      "line-dasharray": [1.5, 2.5],
                    }}
                  />
                </Source>
              );
            })}

            {/* ACTIVE LEG — bold pastel gradient + soft glow, drawn on top. */}
            {legGeometries[currentLegIndex] && (
              <Source
                id="leg-active"
                type="geojson"
                lineMetrics
                data={{
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "LineString",
                    coordinates: legGeometries[currentLegIndex].geometry.coordinates,
                  } as never,
                }}
              >
                {/* Diffuse glow underlay so the active line "lifts" off the map. */}
                <Layer
                  id="leg-active-glow"
                  type="line"
                  layout={{ "line-cap": "round", "line-join": "round" }}
                  paint={{ "line-color": "#c4b5fd", "line-width": 20, "line-opacity": 0.35, "line-blur": 12 }}
                />
                <Layer
                  id="leg-active-line"
                  type="line"
                  layout={{ "line-cap": "round", "line-join": "round" }}
                  paint={{
                    "line-width": 11,
                    "line-opacity": 0.98,
                    // Gentle pastel sweep along the leg (start → end).
                    "line-gradient": [
                      "interpolate", ["linear"], ["line-progress"],
                      0, "#a5b4fc",     // indigo-300
                      0.35, "#c4b5fd",  // violet-300
                      0.65, "#f0abfc",  // fuchsia-300
                      1, "#fda4af",     // rose-300
                    ],
                  }}
                />
              </Source>
            )}
          </>
        ) : (
          /* USER'S ROUTE (BLUE) — single-destination trips */
          routeGeometry != null && (
            <Source
              id="route"
              type="geojson"
              data={{ type: "Feature", properties: {}, geometry: routeGeometry as never }}
            >
              {/*
                Two lines, not one: a dark casing under a bright core.
                A single pale-blue line at 0.8 opacity took its colour partly
                from whatever it crossed — roads, water, park green — so it
                faded exactly where the map was busiest and needed reading most.
                The casing gives the route an edge of its own, which is how
                every map application draws one, and the core can then be fully
                opaque and properly bright.

                Widths scale with zoom rather than sitting at a fixed 8px: the
                same line that reads as a thread across a city is a stripe
                across a street.
              */}
              <Layer
                id="route-casing"
                type="line"
                layout={{ "line-cap": "round", "line-join": "round" }}
                paint={{
                  "line-color": "#1e3a8a",
                  "line-opacity": 0.9,
                  "line-width": ["interpolate", ["linear"], ["zoom"], 10, 7, 14, 13, 18, 20],
                }}
              />
              <Layer
                id="route-line"
                type="line"
                layout={{ "line-cap": "round", "line-join": "round" }}
                paint={{
                  "line-color": "#3b82f6",
                  "line-opacity": 1,
                  "line-width": ["interpolate", ["linear"], ["zoom"], 10, 4, 14, 9, 18, 14],
                }}
              />
            </Source>
          )
        )}
      </Map>
    </div>
  );
}

/*
 * Memoised so the whole map subtree (and every Marker reconciliation) is skipped
 * when the parent re-renders for unrelated reasons — filter changes, modal opens,
 * form typing. It still re-renders when its OWN props change (live position,
 * route, live position), which is exactly when the map must update. For this to
 * pay off the parent must pass stable refs for array/callback props (pins,
 * onSelect, onMapClick) — see locations-page memoisation.
 */
export const LocationMapView = memo(LocationMapViewImpl);
