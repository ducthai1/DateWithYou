/*
 * A night map that reads like a map at night, not like a switched-off screen.
 *
 * The base dark style paints everything in neutral greys between rgb(10,10,10)
 * and rgb(35,35,35): the ground is rgb(12,12,12), water is rgb(27,27,29) — a
 * difference of fifteen levels, which no phone screen shows outdoors — and a
 * motorway's core interpolates to #000 above zoom 6, so the biggest roads
 * disappear at exactly the zoom someone rides at. Its sea label is black text
 * at 70% on near-black water, which is not dim, it is invisible.
 *
 * So the geometry is fine and the colours are not. This recolours them, keeping
 * the style's own layers, widths and zoom behaviour.
 *
 * The palette is Google's night map read in daylight terms: a blue-slate
 * ground, water DARKER than the land rather than lighter, built-up areas one
 * step up from open ground, parks desaturated green, and roads climbing a cool
 * ramp from lane to motorway. Two rules shaped it:
 *
 *   Warmth is reserved. Every road stays cool blue-grey so the route line —
 *   drawn over this in the app's terracotta — is the only warm thing on screen
 *   and cannot be mistaken for a highway. Only motorway LABELS take an amber,
 *   and they are small enough not to compete.
 *
 *   Labels are for reading. Place names sit near #c7d0dc against a #17212e
 *   ground, with a dark halo so they hold over roads and water alike.
 */

type StyleMap = {
  getLayer: (id: string) => unknown;
  setPaintProperty: (id: string, prop: string, value: unknown) => void;
};

/** ground → built-up → water → green, and the road ramp on top. */
const GROUND = "#17212e";
const GROUND_RAISED = "#1c2634";
const WATER = "#0c1522";
const WATER_EDGE = "#13233a";
const PARK = "#1a3025";
const WOOD = "#1a2c22";
const BUILDING = "#212d3d";
const RAIL = "#2a3546";

const ROAD_PATH = "#2a3441";
const ROAD_MINOR = "#2c3848";
const ROAD_MAJOR = "#3b4a5d";
const ROAD_MOTORWAY = "#4d6079";
const CASING_MAJOR = "#101821";
const CASING_MOTORWAY = "#0e151e";

const LABEL_PLACE = "#c7d0dc";
const LABEL_ROAD = "#93a1b3";
const LABEL_MOTORWAY = "#e0b783";
const LABEL_WATER = "#6d93bd";
const HALO = "#0d1620";

const BOUNDARY = "#415065";

/**
 * Every override, as [layer, paint property, value].
 *
 * A flat table rather than per-layer code: the base style names 47 layers and
 * carries no grouping, so the only honest way to be sure nothing was left at
 * rgb(12,12,12) is to be able to read the whole list at once. Layers the style
 * does not have are skipped, which keeps this from breaking if the CDN's style
 * gains or loses one.
 */
const OVERRIDES: Array<[string, string, unknown]> = [
  ["background", "background-color", GROUND],

  ["water", "fill-color", WATER],
  ["waterway", "line-color", WATER_EDGE],
  ["water_name", "text-color", LABEL_WATER],
  ["water_name", "text-halo-color", WATER],
  ["water_name", "text-halo-width", 1.2],

  ["landcover_ice_shelf", "fill-color", GROUND_RAISED],
  ["landcover_glacier", "fill-color", GROUND_RAISED],
  ["landuse_residential", "fill-color", GROUND_RAISED],
  ["landcover_wood", "fill-color", WOOD],
  ["landuse_park", "fill-color", PARK],

  ["building", "fill-color", BUILDING],
  ["building", "fill-outline-color", GROUND],

  ["aeroway-area", "fill-color", GROUND_RAISED],
  ["aeroway-taxiway", "line-color", ROAD_MINOR],
  ["aeroway-runway-casing", "line-color", CASING_MAJOR],
  ["aeroway-runway", "line-color", ROAD_MAJOR],

  ["road_area_pier", "fill-color", GROUND_RAISED],
  ["road_pier", "line-color", GROUND_RAISED],

  ["highway_path", "line-color", ROAD_PATH],
  ["highway_minor", "line-color", ROAD_MINOR],
  ["highway_major_casing", "line-color", CASING_MAJOR],
  ["highway_major_inner", "line-color", ROAD_MAJOR],
  ["highway_major_subtle", "line-color", ROAD_MINOR],
  ["highway_motorway_casing", "line-color", CASING_MOTORWAY],
  ["highway_motorway_subtle", "line-color", ROAD_MAJOR],
  /*
   * The style's own expression fades this from a bright grey at zoom 5.8 to
   * pure black by zoom 6 — sensible for a map whose motorways are drawn by the
   * casing alone, ruinous here. Same interpolation shape, so the far-out view
   * still hands over to the casing gradually, but it hands over to a colour
   * that exists.
   */
  [
    "highway_motorway_inner",
    "line-color",
    ["interpolate", ["linear"], ["zoom"], 5.8, "#6f83a0", 6, ROAD_MOTORWAY],
  ],

  ["railway_transit", "line-color", RAIL],
  ["railway_transit_dashline", "line-color", GROUND],
  ["railway_minor", "line-color", RAIL],
  ["railway_minor_dashline", "line-color", GROUND],
  ["railway", "line-color", RAIL],
  ["railway_dashline", "line-color", GROUND],

  ["highway_name_other", "text-color", LABEL_ROAD],
  ["highway_name_other", "text-halo-color", HALO],
  ["highway_name_motorway", "text-color", LABEL_MOTORWAY],
  // The style gives this label no halo at all, which on a motorway's own core
  // leaves it competing with the line under it.
  ["highway_name_motorway", "text-halo-color", CASING_MOTORWAY],
  ["highway_name_motorway", "text-halo-width", 1.2],

  ["boundary_state", "line-color", BOUNDARY],
  ["boundary_country_z0-4", "line-color", BOUNDARY],
  ["boundary_country_z5-", "line-color", BOUNDARY],
];

/** Place names all share one treatment; listed apart to keep the table short. */
const PLACE_LAYERS = [
  "place_other",
  "place_suburb",
  "place_village",
  "place_town",
  "place_city",
  "place_city_large",
  "place_state",
  "place_country_other",
  "place_country_minor",
  "place_country_major",
];

/**
 * Recolour the night style in place. Returns how many properties were set, so a
 * caller can tell "applied" from "the style had none of these layers".
 *
 * Safe to call on every style event and cheap enough to: setting a paint
 * property to the value it already holds is a no-op inside MapLibre.
 */
export function applyNightPalette(map: StyleMap): number {
  let changed = 0;
  const set = (id: string, prop: string, value: unknown) => {
    try {
      if (!map.getLayer(id)) return;
      map.setPaintProperty(id, prop, value);
      changed++;
    } catch {
      // One layer the style does not paint the way we assumed is not a reason
      // to leave the rest of the map black.
    }
  };
  for (const [id, prop, value] of OVERRIDES) set(id, prop, value);
  for (const id of PLACE_LAYERS) {
    set(id, "text-color", LABEL_PLACE);
    set(id, "text-halo-color", HALO);
    set(id, "text-halo-width", 1.1);
  }
  return changed;
}
