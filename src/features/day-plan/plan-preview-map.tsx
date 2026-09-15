"use client";

import { useMemo } from "react";
import Map, { Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

const MAP_STYLE_DAY = "https://tiles.openfreemap.org/styles/liberty";

export type PreviewPin = {
  key: string;
  label: string;
  geo: { lat: number; lng: number };
  /** A place Google found, which is not in the database until this is confirmed. */
  suggested: boolean;
};

/**
 * The little map on the preview screen.
 *
 * Deliberately its OWN map and not the app's main one. Places the planner
 * found are on this map before anybody has agreed to them, and the rule the
 * whole feature rests on is that nothing reaches the database — or the real
 * map — until somebody presses Chốt. Feeding unsaved pins into `/map` would
 * blur exactly the line the rest of the design is built around.
 *
 * It also stays still. No follow, no easing, no camera animation: the ride
 * screen's freeze was measured to be MapLibre re-running label placement on
 * every frame of a moving camera, and this map has no reason to move at all.
 */
export function PlanPreviewMap({ pins }: { pins: PreviewPin[] }) {
  const view = useMemo(() => {
    if (!pins.length) return null;
    const lat = pins.reduce((a, p) => a + p.geo.lat, 0) / pins.length;
    const lng = pins.reduce((a, p) => a + p.geo.lng, 0) / pins.length;
    const spread = Math.max(
      ...pins.map((p) => Math.abs(p.geo.lat - lat) + Math.abs(p.geo.lng - lng)),
      0.002,
    );
    // Rough but stable: enough to keep every stop on screen without a fitBounds
    // pass that would animate the camera.
    const zoom = spread > 0.08 ? 11 : spread > 0.03 ? 12.5 : spread > 0.012 ? 13.5 : 14.5;
    return { latitude: lat, longitude: lng, zoom };
  }, [pins]);

  if (!view) return null;

  return (
    <div className="border-border relative h-48 w-full overflow-hidden rounded-xl border">
      <Map
        initialViewState={view}
        mapStyle={MAP_STYLE_DAY}
        style={{ width: "100%", height: "100%" }}
        /* Attribution stays ON. Suggested places come from OpenStreetMap via
           Stadia, and ODbL requires crediting the source wherever that data is
           shown — this little map is exactly where it is shown. */
        attributionControl={{ compact: true }}
        dragRotate={false}
        pitchWithRotate={false}
      >
        {pins.map((p, i) => (
          <Marker key={p.key} latitude={p.geo.lat} longitude={p.geo.lng} anchor="bottom">
            <span
              className={
                "flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-bold shadow " +
                (p.suggested
                  ? "border-dashed border-sky-500 bg-white/90 text-sky-700"
                  : "border-white bg-[#c2693f] text-white")
              }
              title={p.label}
            >
              {i + 1}
            </span>
          </Marker>
        ))}
      </Map>
    </div>
  );
}
