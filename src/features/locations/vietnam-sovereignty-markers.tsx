"use client";

import { Marker } from "react-map-gl/maplibre";

/**
 * Hoàng Sa and Trường Sa, marked as Vietnam's, on every view of the map.
 *
 * These are not places anyone saved and they never enter a space's list — they
 * are part of the map itself, the way a coastline is. Base map tiles come from
 * a third party and label these archipelagos inconsistently or not at all, so
 * the product states the position rather than leaving it to whoever drew the
 * tiles.
 *
 * Coordinates are the ones the pins resolve to on Google Maps:
 *   Trường Sa  10.723282, 115.8264655
 *   Hoàng Sa   16.844744, 112.347561
 *
 * Rendered as DOM markers rather than a tile layer so they keep a constant
 * pixel size — readable at the zoom where the whole country fits on screen,
 * which is the view this exists for.
 */

export const VN_ARCHIPELAGOS = [
  {
    id: "hoang-sa",
    name: "Quần đảo Hoàng Sa",
    lat: 16.844744,
    lng: 112.347561,
  },
  {
    id: "truong-sa",
    name: "Quần đảo Trường Sa",
    lat: 10.723282,
    lng: 115.8264655,
  },
] as const;

/** The flag's red and yellow, so the claim reads at a glance. */
const VN_RED = "#DA251D";
const VN_YELLOW = "#FFCD00";

export function VietnamSovereigntyMarkers() {
  return (
    <>
      {VN_ARCHIPELAGOS.map((a) => (
        <Marker key={a.id} longitude={a.lng} latitude={a.lat} anchor="bottom">
          {/* pointer-events-none: this is a statement on the map, not a control.
              Swallowing taps here would block panning over open sea. */}
          <div
            className="pointer-events-none relative flex flex-col items-center"
            role="img"
            aria-label={`${a.name} — quần đảo của Việt Nam`}
          >
            <span
              className="mb-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow-lg"
              style={{ backgroundColor: VN_RED }}
            >
              {a.name}
              <span className="ml-1 font-semibold opacity-90">· Việt Nam</span>
            </span>
            {/* A halo, because at the zoom this exists for the base tiles draw
                nothing here at all — the pin sits on plain blue with no
                coastline near it to give it scale. Static, not pulsing: a
                permanent animation on the map costs a composited layer every
                frame for no added meaning. */}
            <span
              className="absolute bottom-2 h-12 w-12 rounded-full"
              style={{ backgroundColor: "rgba(218,37,29,0.22)", boxShadow: "0 0 0 3px rgba(255,255,255,0.55)" }}
            />
            <svg width="34" height="43" viewBox="0 0 24 30" className="relative drop-shadow-lg" aria-hidden="true">
              <path
                d="M12 0C5.4 0 0 5.4 0 12c0 8.2 12 18 12 18s12-9.8 12-18c0-6.6-5.4-12-12-12z"
                fill={VN_RED}
                stroke="#fff"
                strokeWidth="1.5"
              />
              {/* The flag's star, drawn rather than an emoji so it renders the
                  same on every platform. */}
              <path
                d="M12 6.2l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z"
                fill={VN_YELLOW}
              />
            </svg>
          </div>
        </Marker>
      ))}
    </>
  );
}
