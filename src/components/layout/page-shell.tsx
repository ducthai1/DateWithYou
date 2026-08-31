import { cn } from "@/lib/utils";
import { ToneArt } from "@/components/theme/tone-art";
import type { ArtName } from "@/lib/tone";

/**
 * The page container and its title banner, in one place.
 *
 * Four screens had grown their own copy of the same two blocks — the
 * `max-w-[1400px]` column and the gradient banner — so a spacing change
 * meant four edits and they had already drifted apart.
 *
 * The header is outside the scrollable area, not pinned over it. MainWrapper
 * gives the app a window-height frame; this splits its share of that frame
 * into a header row that does not move and a scroll box beneath it. Nothing
 * is sticky, nothing is masked, and nothing passes behind the header.
 */

export function PageShell({
  header,
  children,
  className,
}: {
  /** PageHeader rendered above the scrollable content area. */
  header?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  // Common gutter and width tokens shared between the header wrapper and the
  // scrollable body so both align on the same grid.
  const gutterCls =
    "[--page-gutter:1rem] shorter:[--page-gutter:0.75rem] md:[--page-gutter:30px]";

  if (header) {
    /*
     * Two rows: a header that does not scroll, and a box below it that does.
     *
     * The previous attempt pinned the header over the content with `sticky`
     * plus a translucent full-bleed strip. That strip was the bug: a pale bar
     * across the top with the page sliding blurrily under it, and its edges
     * visible past the column. Nothing overlaps here — the header simply is
     * not inside the thing that scrolls.
     *
     * The frame comes from MainWrapper (a 100dvh flex column), so `flex-1`
     * plus `min-h-0` is what lets the scroll box take the space that is left.
     * `min-h-0` is not optional: a flex child defaults to min-height:auto and
     * would grow to fit its content instead of scrolling.
     */
    return (
      <div className={cn(gutterCls, "flex min-h-0 flex-1 flex-col", className)}>
        <div className="shrink-0 px-[var(--page-gutter)] pt-6 short:pt-3">
          <div className="mx-auto w-full max-w-[1400px]">{header}</div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[var(--page-gutter)]">
          <div
            className={cn(
              "mx-auto w-full max-w-[1400px] space-y-6 pt-2",
              // The bottom nav is fixed over this box on a phone, so the space
              // it needs is reserved here, where the scrolling actually happens.
              "pb-[calc(1.5rem+4rem+env(safe-area-inset-bottom))] md:pb-6",
              "short:space-y-4 shorter:space-y-3",
            )}
          >
            {children}
          </div>
        </div>
      </div>
    );
  }

  // No header — plain scrolling container (same as before).
  return (
    <div
      className={cn(
        gutterCls,
        // Also inside MainWrapper's frame, so this one scrolls itself.
        "min-h-0 flex-1 overflow-y-auto overscroll-contain px-[var(--page-gutter)]",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto w-full max-w-[1400px] space-y-6 pt-6",
          "pb-[calc(1.5rem+4rem+env(safe-area-inset-bottom))] md:pb-6",
          "short:space-y-4 short:pt-3 shorter:space-y-3",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  art,
  artPosition,
  banner,
  className,
}: {
  title: React.ReactNode;
  /** One line of orientation. Hidden when the window is too short to spare it. */
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /**
   * Artwork behind the band, instead of the flat accent gradient.
   *
   * The band was two accent tints and a line of type on every screen in the
   * app, which made every screen look like every other one. A picture behind
   * it is the cheapest way for a screen to say what it is before you read a
   * word — and it is where the brand artwork earns its keep on screens that
   * HAVE data, rather than only in the empty state nobody with data ever sees.
   *
   * The gradient does not go away: it becomes a scrim over the picture, so the
   * title keeps its contrast whatever the artwork does underneath.
   */
  art?: ArtName;
  /** Which part of the artwork survives the crop, e.g. "center 35%". */
  artPosition?: string;
  /**
   * A line of live status to sit inside the artwork band.
   *
   * Things like "còn 362 ngày" were rendering as their own full-width strip
   * under the header, which spends a whole row of a phone screen on one short
   * sentence while the band above it has empty space across most of its width.
   * Put it in the band and the sentence gets read more, not less.
   *
   * Only rendered when there IS a band — without artwork the header is a title
   * bar with no room to host anything.
   */
  banner?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        /*
         * `relative` is load-bearing, not decoration.
         *
         * The artwork layer inside is `absolute inset-0`, so it is sized by the
         * nearest POSITIONED ancestor. This box used to be `sticky`, which is
         * positioned, so it worked by accident; when the sticky came off,
         * nothing here was positioned any more and the picture resolved against
         * something much further up — it stopped being a band behind a title
         * and became a full-page image with the band's border drawn on top of
         * it. `z-30` was inert for the same reason.
         */
        "relative z-30 flex flex-col gap-y-3 rounded-2xl px-4 py-4 shadow-sm",
        // The blur only earns its cost where there is no artwork; with a
        // picture behind the title the band is opaque already, and a
        // backdrop-filter over that area is one of the most expensive layers
        // the app paints.
        !art && "backdrop-blur-md",
        // Without artwork the band keeps the accent gradient it always had.
        // With artwork the gradient moves to the scrim below, so painting it
        // here too would double-tint the picture.
        art
          ? cn(
              "min-h-[8rem] justify-end sm:min-h-[9rem]",
              "short:min-h-0 short:justify-between",
            )
          : "from-gradient-from/15 to-gradient-to/15 bg-gradient-to-r",
        "sm:flex-row sm:items-center sm:justify-between sm:gap-y-0",
        "short:mb-3 short:rounded-xl short:py-2.5 shorter:py-2",
        className,
      )}
    >
      {/* Artwork layer + scrim. Both are aria-hidden decoration; the heading
          below is the accessible name of the screen either way.

          The scrim is a left-to-right ramp rather than a flat wash: the title
          sits left, so that is the only region that must guarantee contrast,
          and flattening the whole picture to make room for text nobody has
          reached yet wastes the picture. */}
      {art ? (
        // Its own clipping box, so the artwork is rounded off at the band's
        // corners without the band clipping the actions row on top of it.
        //
        // bg-card sits under the picture because three of the illustrations are
        // cut out, and a band you can see through lets whatever is scrolling
        // beneath it show up inside the header.
        <div aria-hidden="true" className="bg-card absolute inset-0 -z-10 overflow-hidden rounded-2xl">
          <ToneArt
            name={art}
            fill
            position={artPosition ?? "center 40%"}
            sizes="(max-width: 768px) 100vw, 960px"
            /* Soft focus here, sharp on the page ground behind it. The band is
               a strip a title sits directly on top of, so detail in it competes
               with the words; the ground is the one that should be legible as a
               picture. Scaled up because a blur samples past its own edges and
               would otherwise leave a pale rim inside the rounded corners. */
            className="scale-110 blur-[3px]"
          />
          <div className="from-card/95 via-card/70 to-card/15 absolute inset-0 bg-gradient-to-r" />
        </div>
      ) : null}

      {/* Status line, top-right of the band. Away from the title so neither
          truncates the other, and inside the scrim's thin end where the
          artwork is busiest — a chip needs its own surface there anyway. */}
      {art && banner ? (
        <div className="absolute right-3 top-3 z-10 max-w-[min(60%,22rem)] short:static short:mb-1 short:max-w-none">
          {banner}
        </div>
      ) : null}

      <div className="min-w-0">
        <h1 className="text-accent truncate text-2xl font-semibold short:text-xl shorter:text-lg">
          {title}
        </h1>
        {subtitle ? (
          // Dropped rather than shrunk: at this height every line is a
          // trade against content, and the title already says where you are.
          <p className="text-muted-foreground mt-0.5 text-sm short:hidden">{subtitle}</p>
        ) : null}
      </div>
      {/* Wraps on a narrow screen instead of crushing its contents. The
          library header holds a search field and two buttons; on one 390px row
          the field collapsed to ~90px and the button broke onto two lines. */}
      {actions ? (
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:shrink-0 lg:flex-nowrap">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
