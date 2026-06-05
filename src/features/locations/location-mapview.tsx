"use client";

import Map, { Marker, Source, Layer } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { LatLng } from "@/lib/maps";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
// Ho Chi Minh City centre.
const DEFAULT_CENTER = { longitude: 106.7009, latitude: 10.7769, zoom: 12 };

export type MapPin = {
  id: string;
  name: string;
  geo: LatLng | null;
  status: "want_to_go" | "visited";
};

export function LocationMapView({
  pins,
  routeGeometry,
  selectedId,
  onSelect,
  onMapClick,
}: {
  pins: MapPin[];
  routeGeometry?: unknown;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onMapClick?: (geo: LatLng) => void;
}) {
  if (!TOKEN) {
    return (
      <div className="border-border bg-muted/40 text-muted-foreground flex h-full min-h-[280px] items-center justify-center rounded-xl border p-6 text-center text-sm">
        Bản đồ cần <code>NEXT_PUBLIC_MAPBOX_TOKEN</code>. Thêm vào{" "}
        <code>.env.local</code> để hiển thị.
      </div>
    );
  }

  return (
    <div className="h-full min-h-[280px] overflow-hidden rounded-xl">
      <Map
        mapboxAccessToken={TOKEN}
        initialViewState={DEFAULT_CENTER}
        mapStyle="mapbox://styles/mapbox/light-v11"
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
              <span
                className={`block h-4 w-4 cursor-pointer rounded-full border-2 border-white shadow ${
                  p.status === "visited" ? "bg-emerald-500" : "bg-accent"
                } ${selectedId === p.id ? "ring-2 ring-offset-1" : ""}`}
                title={p.name}
              />
            </Marker>
          ))}

        {routeGeometry != null && (
          <Source
            id="route"
            type="geojson"
            data={{ type: "Feature", properties: {}, geometry: routeGeometry as never }}
          >
            <Layer
              id="route-line"
              type="line"
              paint={{ "line-color": "#b08968", "line-width": 4 }}
            />
          </Source>
        )}
      </Map>
    </div>
  );
}
