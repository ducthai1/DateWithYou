/**
 * What the app's screens show while their payload is in flight.
 *
 * ── Why this draws no skeleton ─────────────────────────────────────────────
 *
 * It used to: one shared column of grey bones. That was wrong three ways at
 * once, and all three were visible on a desktop the moment it shipped.
 *
 * 1. **Two skeletons in a row.** Every screen here already has its own
 *    loading state, shaped like its own content (library-page, memory-timeline,
 *    calendar-view, the vault panels…). A route-level skeleton plays first and
 *    is then replaced by the real one — the same wait, told twice.
 * 2. **It could not match the layout.** The real frame is PageShell: a
 *    `max-w-[87.5rem]` column with a 30px gutter and a header row above it.
 *    The bones were `max-w-2xl` — a 672px column adrift in a 1400px page.
 * 3. **So it moved the page.** Different width, different padding, different
 *    vertical rhythm: the bones landed in one box and the content arrived in
 *    another, which reads as the UI jumping under your hands.
 *
 * A route boundary does not have to draw anything to do its job. Its job is to
 * exist: without one, App Router cannot prefetch a dynamic route and will not
 * commit the navigation until the server answers, so the tapped tab stays
 * unlit for a whole round trip (measured at 150ms RTT: 207–298ms, and 723ms
 * for /home; with a boundary, 20–67ms). All of that still holds with nothing
 * on screen.
 *
 * So this is one hairline bar, positioned out of the flow. It cannot mismatch
 * a layout it does not occupy, it cannot shift anything, and it leaves the
 * screen's own skeleton to be the only skeleton.
 */
export default function AppRouteLoading() {
  return (
    /* Zero height: the bar hangs off this box rather than taking a row of its
       own, so the content that follows starts exactly where it always does. */
    <div aria-hidden="true" className="pointer-events-none relative h-0">
      <span className="bg-accent-soft absolute inset-x-0 top-0 h-[3px] overflow-hidden">
        {/* The same indeterminate segment the map veil uses — one animation,
            declared once in globals.css. */}
        <span className="vivu-bar-slide bg-accent absolute inset-y-0 w-1/3" />
      </span>
    </div>
  );
}
