/**
 * Paint for a route line whose ridden part is rubbed out.
 *
 * `line-gradient` rather than re-slicing the coordinates every fix: the shape
 * is sent to the GPU once and only this one paint value changes as the rider
 * moves, so a position update costs a repaint instead of a source update on a
 * polyline that can hold a couple of thousand points.
 *
 * Falls back to a plain colour whenever the fraction is unknown or at either
 * end — a gradient needs a stop strictly inside the line, and 0 or 1 is not
 * one. The unknown case is the common one: before a ride starts there is
 * nothing behind the rider yet.
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
  return {
    // line-color is ignored where a gradient is present; the opacity still
    // applies on top of it, so the casing keeps being a casing.
    "line-opacity": opacity,
    /*
     * `step`, not `interpolate` — and that is not a style preference.
     *
     * MapLibre bakes a `line-gradient` into a 1-D texture. For an `interpolate`
     * expression that texture is **always 256 texels for the whole line**, and
     * it is sampled LINEAR (`updateGradientTexture`, maplibre-gl 5.x). On an
     * 11.6 km route one texel is 45 m, and at the zoom used while riding that
     * is over 100 CSS px — so the "cut" was a wash a third of a screen long,
     * landing ahead of the rider or behind them depending on where the
     * fraction fell inside a texel. Measured on a real ride screen: the line
     * stayed fully opaque for 50 px past the rider and took another 90 px to
     * disappear.
     *
     * For a `step` expression the same function raises the resolution with the
     * line's length and samples NEAREST. Same two colours, an actual edge, and
     * the edge lands where the rider is.
     */
    "line-gradient": ["step", ["line-progress"], "rgba(0,0,0,0)", f, colour],
  };
}
