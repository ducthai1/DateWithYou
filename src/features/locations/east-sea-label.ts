/**
 * Rename the sea on the base map to Biển Đông.
 *
 * The tiles come from OpenFreeMap and print "South China Sea / 南海". A plate
 * drawn at a fixed coordinate cannot cover that: the provider decides where the
 * label sits for the current view, so it moves with every pan and zoom and the
 * plate misses it. Overriding the layer's own `text-field` puts our name in the
 * label's own position instead, at every zoom, and leaves every other water
 * name alone.
 *
 * The original expression is read back from the style rather than copied here,
 * so this keeps working if the upstream style changes how it builds labels.
 */

/** Layers in the Liberty style that draw water names. */
const WATER_LABEL_LAYERS = ["water_name_point_label", "water_name_line_label"];

/** Names the sea is published under, latin and local. */
const SOUTH_CHINA_SEA = ["South China Sea", "Biển Đông", "南海"];

type StyleMap = {
  getLayer: (id: string) => unknown;
  getLayoutProperty: (id: string, prop: string) => unknown;
  setLayoutProperty: (id: string, prop: string, value: unknown) => void;
};

export function applyEastSeaLabel(map: StyleMap): number {
  let changed = 0;
  for (const id of WATER_LABEL_LAYERS) {
    try {
      if (!map.getLayer(id)) continue;
      const original = map.getLayoutProperty(id, "text-field");
      if (original == null) continue;
      // Match on any of the published names, and on the untranslated `name`
      // too — which field carries it depends on the tile build.
      const matches = SOUTH_CHINA_SEA.flatMap((n) => [
        ["==", ["get", "name:latin"], n],
        ["==", ["get", "name:en"], n],
        ["==", ["get", "name"], n],
      ]);
      map.setLayoutProperty(id, "text-field", [
        "case",
        ["any", ...matches],
        "Biển Đông",
        original,
      ]);
      changed++;
    } catch (err) {
      // A style that does not carry these layers is not an error worth
      // breaking the map over — the markers still state the position.
      console.error("east-sea-label: could not relabel", id, err);
    }
  }
  return changed;
}
