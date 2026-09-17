/**
 * Paint for a route line whose ridden part is rubbed out.
 *
 * `line-gradient` rather than re-slicing the coordinates every fix: the shape
 * is sent to the GPU once and only this one paint value changes as the rider
 * moves, so a position update costs a repaint instead of a source update on a
 * polyline that can hold a couple of thousand points.
 *
 * Falls back to a plain colour whenever the fraction is unknown or at either
 * end — a gradient needs strictly ascending stops, and "0 to 0" is not one.
 * The unknown case is the common one: before a ride starts there is nothing
 * behind the rider yet.
 */
export function trailPaint(
  fraction: number | null | undefined,
  colour: string,
  opacity: number,
): Record<string, unknown> {
  const f = typeof fraction === "number" && Number.isFinite(fraction) ? fraction : null;
  if (f === null || f <= 0.001 || f >= 0.999) {
    return { "line-color": colour, "line-opacity": opacity };
  }
  const clear = "rgba(0,0,0,0)";
  return {
    // line-color is ignored where a gradient is present; the opacity still
    // applies on top of it, so the casing keeps being a casing.
    "line-opacity": opacity,
    "line-gradient": [
      "interpolate",
      ["linear"],
      ["line-progress"],
      0, clear,
      f, clear,
      // A hard edge, not a fade: the point of the cut is to say "you are HERE",
      // and a soft ramp puts the boundary somewhere the rider has to guess.
      Math.min(f + 0.002, 0.9995), colour,
      1, colour,
    ],
  };
}
