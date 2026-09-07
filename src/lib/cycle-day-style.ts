/**
 * How a cycle day looks, in one place, shared by the desktop month grid and the
 * mobile week strip so the two cannot drift apart.
 *
 * Two decisions, both made after looking at screenshots rather than guessing:
 *
 * SOLID, not translucent. Every calendar cell carries a full-bleed
 * illustration. A soft pastel wash over that art came out muddy brown and a
 * radial tint disappeared entirely — the marker has to be opaque to survive an
 * arbitrary picture behind it.
 *
 * ONE PALETTE, no `dark:` variants. This app defines a single light set of
 * tokens (--card is #fff, with no dark override anywhere), but Tailwind's
 * `dark:` variant keys off the VISITOR'S system preference — so a chip written
 * as `bg-rose-100 dark:bg-rose-950` turns near-black for anyone whose laptop is
 * in dark mode while the page around it stays white. That is what the muddy
 * maroon ribbon in the first screenshots actually was.
 *
 * BERRY ROSE, not the accent and not the special-date pink. Three meanings live
 * on this grid: today/selected (terracotta accent), a special date (light pink
 * heart), and the cycle window. Reusing either existing colour would make two
 * different things look like the same thing.
 */

/** The most likely day: a filled disc around the number, like today's. */
export const CYCLE_PEAK_DISC = "bg-rose-600 text-white shadow-sm";

/** The edge days: the number itself carries the colour, keeping its halo. */
export const CYCLE_WINDOW_TEXT = "text-rose-600";

/** Indicator dot, for the mobile strip where there is no room for words. */
export const CYCLE_DOT = "bg-rose-500";

/** Desktop ribbon under the number — the two words that say what the day is. */
export const CYCLE_RIBBON_PEAK = "bg-rose-600 text-white";
export const CYCLE_RIBBON_WINDOW = "bg-rose-100 text-rose-700";
