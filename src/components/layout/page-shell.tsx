"use client";

import { useEffect, useState } from "react";
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
  /*
   * The band stays on screen, and shrinks once the page has moved.
   *
   * It used to scroll away on any screen carrying artwork, so reaching a quick
   * action on a long page meant scrolling all the way back to the top. Simply
   * pinning it was not enough either: at 144px an artwork band would hold a
   * fifth of a phone screen hostage for a picture nobody is looking at any
   * more. Once you are reading, the band gives the picture back and keeps only
   * what is useful — the title and the actions.
   *
   * The threshold has a dead band (56 up, 24 down) so a page that ends a few
   * pixels either side of one number cannot flicker between the two states.
   */
  const [condensed, setCondensed] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setCondensed((was) => (was ? y > 24 : y > 56));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={cn(
        "z-20 mb-6 flex flex-col gap-y-3 rounded-2xl px-4 py-4 shadow-sm backdrop-blur-md",
        // Below the app header on mobile, which is itself sticky at the top.
        "sticky top-[3.25rem] md:top-2",
        "transition-[min-height,padding,box-shadow] duration-300 ease-out",
        // No `relative` here. `sticky` is itself a positioned element, so the
        // artwork layer and the status chip still lay out against this box —
        // and `relative` would quietly win the position slot and put the band
        // back to scrolling away, which is the whole thing being fixed.
        // Without artwork the band keeps the accent gradient it always had.
        // With artwork the gradient moves to the scrim below, so painting it
        // here too would double-tint the picture.
        art
          // One height for every screen that carries artwork. They were drifting
          // — a band that is 192px on one route and 140px on the next makes the
          // content below start at a different place each time you navigate,
          // which reads as the page settling rather than as a design.
          // Measured: at 11rem the band was 176px holding one title and one
          // subtitle at its foot, so roughly 100px of it was empty and every
          // screen's content started that much further down. 9rem still shows
          // enough picture to be a picture.
          ? cn(
              "justify-end short:min-h-0 short:justify-between",
              condensed ? "min-h-0 py-2.5" : "min-h-[8rem] sm:min-h-[9rem]",
            )
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
            /* Soft focus here, sharp on the page ground behind it. The band is
               a strip a title sits directly on top of, so detail in it competes
               with the words; the ground is the one that should be legible as a
               picture. Scaled up because a blur samples past its own edges and
               would otherwise leave a pale rim inside the rounded corners. */
            className={cn(
              "scale-110 blur-[3px] transition-opacity duration-300",
              condensed && "opacity-40",
            )}
          />
          <div className="from-card/95 via-card/70 to-card/15 absolute inset-0 bg-gradient-to-r" />
        </div>
      ) : null}

      {/* Status line, top-right of the band. Away from the title so neither
          truncates the other, and inside the scrim's thin end where the
          artwork is busiest — a chip needs its own surface there anyway. */}
      {art && banner ? (
        <div
          className={cn(
            "z-10 max-w-[min(60%,22rem)] short:static short:mb-1 short:max-w-none",
            // Floated into the band's empty corner while the band is tall; once
            // it condenses there is no corner left to float into.
            condensed ? "static mb-1 max-w-none" : "absolute right-3 top-3",
          )}
        >
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
          <p
            className={cn(
              "text-muted-foreground mt-0.5 text-sm short:hidden",
              condensed && "hidden",
            )}
          >
            {subtitle}
          </p>
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
