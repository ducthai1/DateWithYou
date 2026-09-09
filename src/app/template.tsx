/*
 * The page-entrance transition. Re-mounts on every route change (App Router
 * template.tsx semantics), which is what makes this the place for it.
 *
 * ── Why this is CSS, and not framer-motion ─────────────────────────────────
 *
 * It used to be a `motion.div` with `initial={{ opacity: 0, y: 8 }}`. Framer
 * renders `initial` as an INLINE STYLE on the server, so every page in this
 * app shipped its HTML inside `style="opacity: 0"` and stayed invisible until
 * React had hydrated and could animate it back. Server rendering bought the
 * app nothing on first paint: measured on /map in a production build at
 * 1.5 Mbps with a cold cache, the route's own HTML was painted at 1.25s and
 * still showed a blank screen, because the wrapper hiding it was waiting on
 * the JavaScript. That is the "app looks broken while it loads" complaint, and
 * it applied to every route.
 *
 * A CSS animation cannot hide anything it has not started animating: the
 * element's own opacity is 1, the keyframe supplies the 0 only while it runs,
 * and if the stylesheet is late the content simply appears. No JavaScript is
 * involved, so this file no longer needs to be a Client Component at all —
 * which is the same trade the landing page's entrances already made (see
 * globals.css: framer was ~45kB in front of the largest paint).
 *
 * ── Why there is no transform here ─────────────────────────────────────────
 *
 * ⛔ Nothing that creates a containing block belongs in this wrapper — no `y`,
 * no `scale`, no `filter`.
 *
 * It sits between the app frame and EVERY page, and a transformed element
 * becomes the containing block for every `position: fixed` descendant inside
 * it. The frame's bottom nav lives OUTSIDE this wrapper, so the wrapper's
 * bottom edge is one nav-height (~72px measured) above the viewport's: for the
 * 150ms the old version animated `y: 8 → 0`, every fixed overlay a page owns
 * was anchored to that shorter box and then jumped when the transform was
 * dropped at the end.
 *
 * Measured on /map: the saved-places sheet (`fixed`, `bottom: 4.75rem`)
 * arrived 72px too high and fell into place on every navigation to the screen
 * — which is what "the bottom sheet drops in from above" was. The map's
 * floating locate button and the `--map-sheet-h` the sheet publishes were off
 * by the same amount while it ran, and /library/luot's fixed feed shared the
 * fault. An 8px rise does not pay for that.
 *
 * A page that wants an entrance animates it itself, from the edge it belongs
 * to — see `.vivu-sheet-in` in globals.css.
 */

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    /*
     * A flex passthrough, not a plain box.
     *
     * This wrapper exists only for the route transition, but App Router puts
     * it between the app frame and every page — so as a `display:block` div
     * it broke the chain: the frame is a 100dvh flex column, and a page
     * asking for `flex-1` inside this got nothing and grew to its content
     * instead. The page header then had no fixed row to sit in and the
     * overflow was simply clipped away.
     *
     * Outside a flex parent (marketing and auth routes, where the frame is
     * not applied) these declarations are inert.
     */
    <div className="vivu-page-in flex min-h-0 flex-1 flex-col">{children}</div>
  );
}
