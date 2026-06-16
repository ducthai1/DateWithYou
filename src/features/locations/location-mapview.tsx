"use client";

import { useEffect, useRef, useState } from "react";
import Map, { Marker, Source, Layer, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LatLng } from "@/lib/maps";
import { cn } from "@/lib/utils";

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

export function LocationMapView({
  pins,
  routeGeometry,
  partnerRouteGeometry,
  selectedId,
  focusGeo,
  userGeo,
  partnerLocation,
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
  partnerRouteGeometry?: unknown;
  selectedId?: string | null;
  focusGeo?: LatLng | null;
  userGeo?: LatLng | null;
  partnerLocation?: { lat: number; lng: number } | null;
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
        onClick={(e) =>
          onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng })
        }
      >
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
                {/* Pulsing accuracy halo */}
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
                Người ấy
              </span>
              <span className="absolute h-12 w-12 animate-ping rounded-full bg-rose-400/30" />
              {partnerAvatar ? (
                <img src={partnerAvatar} alt="Người ấy" className="h-8 w-8 rounded-full border-[2.5px] border-white object-cover shadow-md ring-4 ring-rose-500/30 bg-muted" />
              ) : (
                <span className="block h-5 w-5 rounded-full border-[2.5px] border-white bg-rose-500 shadow ring-4 ring-rose-500/30" />
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
              paint={{ "line-color": "#f43f5e", "line-width": 8, "line-opacity": 0.6 }} // rose-500
            />
          </Source>
        )}

        {/* USER'S ROUTE (BLUE) */}
        {routeGeometry != null && (
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
        )}
      </Map>
    </div>
  );
}
