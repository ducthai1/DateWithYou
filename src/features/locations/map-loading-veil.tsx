/**
 * What covers the map until its first frame is complete.
 *
 * It replaces a flat `bg-muted` rectangle, and the reason is not decoration.
 * A cold /map is ~6s on a throttled phone and ~1.6s with the map cache warm
 * (see public/sw.js), and for all of that time the old veil said nothing at
 * all — a grey box on a screen someone just navigated to reads as "the app
 * broke", not as "this is loading".
 *
 * Four deliberate choices:
 *
 * 1. **No hooks, no `"use client"`.** This is the placeholder the ROUTE renders
 *    into the first bytes of HTML (src/app/map/page.tsx), so it has to paint
 *    with no JavaScript at all. The delayed second line and both animations
 *    are therefore CSS, not state.
 * 2. **Drawn, not photographed.** The brand artwork would have been prettier
 *    and costs 100–150 KB on the one connection that cannot spare it: this
 *    screen is already queueing a 267 KB maplibre chunk and its tiles, and
 *    asking for the same bytes twice is what once turned a 3.4s map into a
 *    26.4s one (see WarmMapAssets). The schematic below is inline SVG and a
 *    gradient — zero requests — and it is the same trick the ride's mini
 *    window uses instead of capturing the real map.
 * 3. **No percentage.** MapLibre can report tiles in flight but not how many
 *    the finished view needs, so any number here would be invented. An
 *    indeterminate bar promises only "still working", which is all that is
 *    actually known.
 * 4. **The second line waits.** Most visits are the warm path and end before
 *    it appears, and telling someone their wait will be long, right as it
 *    finishes, is its own kind of noise.
 */
export function MapLoadingVeil({
  show,
  anchor = "absolute",
  id,
}: {
  show: boolean;
  /** Only the route's pre-hydration copy needs one, so CSS can retire it. */
  id?: string;
  /**
   * `absolute` fills the map's own box — the normal case, inside `#map-view`.
   *
   * `fixed` is for the copy the route renders before any of this screen's
   * JavaScript exists. That one has no positioned map container to fill yet,
   * so it takes the viewport instead, and sits at z-0 like the map it stands
   * in for: under the app's header and bottom nav, over the page ground.
   */
  anchor?: "absolute" | "fixed";
}) {
  return (
    <div
      id={id}
      aria-hidden="true"
      /*
       * `data-veil-idle` stops the two infinite animations below the moment
       * this stops being visible.
       *
       * `opacity: 0` hides an element; it does not stop it animating. Left as
       * it was, the sheen and the progress bar kept ticking on the compositor
       * for the whole time anyone spent on the map — invisible work, on the
       * one screen in this app that is already asking the GPU for everything
       * it has. The element itself stays mounted so the fade-out still runs;
       * only the perpetual motion inside it goes quiet (see globals.css).
       */
      data-veil-idle={show ? undefined : ""}
      className={`bg-muted pointer-events-none inset-0 overflow-hidden transition-opacity duration-500 ${
        anchor === "fixed" ? "fixed z-0" : "absolute z-[1]"
      } ${show ? "opacity-100" : "opacity-0"}`}
    >
      {/* A map being drawn, not a grey field: two road bands, a river, a route
          and its pin. Sized in viewBox units and stretched, so it fills any
          box without a media query. */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 390 700"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <g stroke="currentColor" className="text-foreground/[0.07]" strokeWidth="14">
          <path d="M-20 210 H410" />
          <path d="M-20 470 H410" />
          <path d="M96 -20 V720" />
          <path d="M286 -20 V720" />
        </g>
        <path
          d="M-20 620 C 80 560, 120 470, 210 430 S 340 330, 410 250"
          stroke="currentColor"
          className="text-sky-500/15"
          strokeWidth="22"
          strokeLinecap="round"
        />
        {/* The route stops short of the right edge on purpose: its pin is the
            one shape here with a point, and a point clipped by the frame reads
            as a rendering fault rather than as a destination. */}
        <path
          d="M40 640 C 110 540, 150 470, 230 400 S 286 320, 300 268"
          stroke="currentColor"
          className="text-accent/20"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="1 22"
        />
        <circle cx="300" cy="258" r="8" className="fill-accent/20" />
      </svg>

      {/* One pale sweep across the whole veil. Transform and opacity only — a
          blur or a filter here costs a full repaint on the phone GPUs this
          screen runs on. */}
      <div className="vivu-map-sheen absolute inset-0" />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="text-foreground/75 text-[15px] font-medium">Đang dựng bản đồ…</p>

        <div className="bg-foreground/10 relative h-[3px] w-40 overflow-hidden rounded-full">
          <span className="vivu-bar-slide bg-accent absolute inset-y-0 w-1/3 rounded-full" />
        </div>

        <p className="vivu-veil-hint text-muted-foreground max-w-[15rem] text-[12.5px] leading-relaxed">
          Lần đầu mất vài giây để tải nét đường. Những lần sau mở là có ngay.
        </p>
      </div>
    </div>
  );
}
