"use client";

import { memo, useEffect, useRef, useState } from "react";
import Map, { Marker, Source, Layer, AttributionControl, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { geodesicCircle, type LatLng } from "@/lib/maps";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";

// OpenFreeMap serves free vector tiles + styles with no API key, no signup, and
// no credit card — unlike Mapbox, which gates tokens behind a payment method.
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
// Ho Chi Minh City centre.
const DEFAULT_CENTER = { longitude: 106.7009, latitude: 10.7769, zoom: 12 };

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
  userGeo,
  userAccuracyM,
  partnerLocation,
  partnerPingAction,
  userPingAction,
  followGeo,
  heading,
  userAvatar,
  partnerAvatar,
  traveled,
  onSelect,
  onMapClick,
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
  traveled?: Array<[number, number]>;
  onSelect?: (id: string) => void;
  onMapClick?: (geo: LatLng) => void;
  className?: string;
}) {
  const mapRef = useRef<MapRef>(null);

  // Track manual map interactions to suspend auto-tracking
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      if (isPartner && typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 500]); // Urgent pattern
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

  const handleInteraction = () => {
    setIsUserInteracting(true);
    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    interactionTimeoutRef.current = setTimeout(() => {
      setIsUserInteracting(false);
    }, 2000);
  };

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

  return (
    <div 
      className={cn("h-full min-h-[280px] overflow-hidden rounded-xl border border-border bg-card shadow-sm", className)}
      onPointerDownCapture={handleInteraction}
      onWheelCapture={handleInteraction}
      onTouchStartCapture={handleInteraction}
    >
      <Map
        ref={mapRef}
        initialViewState={DEFAULT_CENTER}
        mapStyle={MAP_STYLE}
        attributionControl={false}
        onClick={(e) =>
          onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng })
        }
      >
        <AttributionControl compact={true} position="top-right" />

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
                {/* Name Label - always visible but subtle, pops on hover/select */}
                <span
                  className={cn(
                    "mb-1 whitespace-nowrap rounded-md bg-white/95 px-1.5 py-0.5 text-[10px] font-bold shadow-sm backdrop-blur-sm transition-all duration-200",
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

        {traveled && traveled.length > 1 && (
          <Source
            id="traveled"
            type="geojson"
            data={{
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: traveled } as never,
            }}
          >
            <Layer
              id="traveled-line"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": "#4f46e5", "line-width": 8, "line-opacity": 1 }}
            />
          </Source>
        )}

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
            <div className="relative flex items-center justify-center group">
              <span className="absolute -top-6 whitespace-nowrap rounded-md bg-white/95 px-1.5 py-0.5 text-[10px] font-bold shadow-sm backdrop-blur-sm transition-all duration-200 opacity-0 group-hover:opacity-100 group-hover:-translate-y-1">
                Người kia
              </span>
              <span className="absolute h-12 w-12 animate-ping rounded-full bg-rose-400/30" />
              {partnerAvatar ? (
                <img src={partnerAvatar} alt="Người kia" className="relative z-10 h-8 w-8 rounded-full border-[2.5px] border-white object-cover shadow-md ring-4 ring-rose-500/30 bg-muted" />
              ) : (
                <span className="relative z-10 block h-5 w-5 rounded-full border-[2.5px] border-white bg-rose-500 shadow ring-4 ring-rose-500/30" />
              )}
            </div>
          </Marker>
        )}

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
              <Layer
                id="route-line"
                type="line"
                layout={{ "line-cap": "round", "line-join": "round" }}
                paint={{ "line-color": "#60a5fa", "line-width": 8, "line-opacity": 0.8 }}
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
 * traveled path, route), which is exactly when the map must update. For this to
 * pay off the parent must pass stable refs for array/callback props (pins,
 * onSelect, onMapClick) — see locations-page memoisation.
 */
export const LocationMapView = memo(LocationMapViewImpl);
