import { cn } from "@/lib/utils";
import { ToneArt } from "@/components/theme/tone-art";
import type { ArtName } from "@/lib/tone";

/**
 * The page container and its sticky title banner, in one place.
 *
 * Four screens had grown their own copy of the same two blocks — the
 * `max-w-[1400px]` column and the `sticky top-2 … rounded-2xl` gradient banner
 * — so a spacing change meant four edits and they had already drifted apart.
 *
 * More importantly they were all tuned against a ~900px-tall window. At 600px,
 * which is exactly what 150% browser zoom gives on a 13" MacBook, the top
 * padding, the banner and its bottom margin spent ~180px before a single row of
 * content appeared. The `short:` and `shorter:` variants pull that back, so the
 * same screen stays usable zoomed in instead of turning into a scroll tube.
 */

export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // The gutter is published as a variable so a full-bleed row can cancel
        // exactly this padding instead of assuming it. ScrollStrip used to
        // hard-code -mx-4; the moment `shorter` narrowed the gutter to 12px
        // that bled 4px past the screen and the page scrolled sideways.
        "[--page-gutter:1rem] shorter:[--page-gutter:0.75rem] md:[--page-gutter:30px]",
        "mx-auto w-full max-w-[1400px] space-y-6 px-[var(--page-gutter)] pt-6 pb-6",
        "short:space-y-4 short:pt-3 shorter:space-y-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  art,
  artPosition,
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
  className?: string;
}) {
  return (
    <div
      className={cn(
        "z-20 mb-6 flex flex-col gap-y-3 rounded-2xl px-4 py-4 shadow-sm backdrop-blur-md",
        art ? "relative" : "sticky top-2",
        // Without artwork the band keeps the accent gradient it always had.
        // With artwork the gradient moves to the scrim below, so painting it
        // here too would double-tint the picture.
        art
          ? "min-h-[9.5rem] justify-end sm:min-h-[12rem] short:min-h-0 short:justify-between"
          : "from-gradient-from/15 to-gradient-to/15 bg-gradient-to-r",
        "sm:flex-row sm:items-center sm:justify-between sm:gap-y-0",
        // Zoomed in, the banner keeps its job — saying where you are — on
        // roughly half the height.
        "short:mb-3 short:rounded-xl short:py-2.5 shorter:py-2",
        !art && "shorter:top-1",
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
        <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden rounded-2xl">
          <ToneArt
            name={art}
            fill
            position={artPosition ?? "center 40%"}
            sizes="(max-width: 768px) 100vw, 960px"
          />
          <div className="from-card/95 via-card/70 to-card/15 absolute inset-0 bg-gradient-to-r" />
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
