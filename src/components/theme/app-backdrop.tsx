"use client";

import { usePathname } from "next/navigation";
import { ToneArt } from "./tone-art";
import type { ArtName } from "@/lib/tone";
import { NAV_HIDDEN_ON } from "@/components/layout/nav-items";

/**
 * The app's ambient ground: the screen's own artwork, faint, behind everything.
 *
 * Every signed-in screen sat on one flat `--background`, which made the app
 * read as a form rather than as the place the marketing pages promise. A tint
 * or a gradient would have been the cheap fix, but the product already owns a
 * set of illustrations — using them is what makes the ground belong to THIS
 * app rather than to any app with a nice colour.
 *
 * Three things keep it from fighting the content:
 *  - it is the same piece the page's own header band shows, so at this opacity
 *    it reads as texture continuing off the band, not as a second picture;
 *  - it is `fixed`, so it does not travel with the scroll and never lines up
 *    with a card edge on the way past;
 *  - the wash on top is opaque near the top-left, where headings and body copy
 *    live, and thins out toward the bottom-right where cards do the covering.
 *
 * `-z-10` puts it above the body's own background fill but below every in-flow
 * element, so cards, headers and text all keep their own surfaces.
 */

/** Which piece grounds which section. Falls through to the app-wide banner. */
const BY_PREFIX: ReadonlyArray<readonly [string, ArtName]> = [
  ["/calendar", "calendarTablet"],
  ["/timeline", "memoriesScrapbook"],
  ["/trips", "tripPlanner"],
  ["/library", "appShowcase"],
  ["/vault", "vaultSafe"],
  ["/wheel", "wheelFood"],
  ["/search", "emptyMap"],
  ["/activity", "bannerWide"],
  ["/home", "heroDesk"],
  ["/settings", "bannerOurPage"],
  ["/onboarding", "mapTreasure"],
];

const FALLBACK: ArtName = "bannerSub";

export function AppBackdrop() {
  const pathname = usePathname();

  /*
   * Two routes opt out.
   *
   * Marketing and auth already have full-page art of their own; a second
   * picture underneath would show through their translucent panels.
   *
   * /map is a live map that fills the viewport — a picture behind it is never
   * seen, and its tiles would be compositing over an image for nothing.
   */
  if (NAV_HIDDEN_ON.includes(pathname) || pathname.startsWith("/map")) return null;

  const hit = BY_PREFIX.find(([prefix]) => pathname.startsWith(prefix));
  const art = hit ? hit[1] : FALLBACK;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <ToneArt
        name={art}
        fill
        position="center"
        // A backdrop is never read closely and is blurred on top of that, so it
        // is served at roughly half the window rather than at full width. On a
        // 1920 screen the full-width hint pulled the 3840 file for something
        // nobody can resolve.
        sizes="(max-width: 768px) 100vw, 960px"
        className="scale-110 opacity-[0.55] blur-[14px] saturate-[1.25]"
      />
      {/* Readability wash. Heaviest top-left, where every screen puts its
          heading and its first line of text, thinning toward the bottom right
          where cards do the covering.

          These numbers were picked by compositing the real artwork over the
          real --background at four strengths and reading a heading and a card
          against each. The first pass multiplied out to about 1.7% of the
          picture surviving at the top left, which is why it looked like
          nothing was there at all.

          The blur is heavy on purpose. At 2px the artwork was still a legible
          scene — on /calendar a camper van and the wordmark sat behind the
          month grid and fought the day numbers for attention. Blurred this far
          the same picture reads as the colour and movement of that screen's
          own illustration, which is what a ground should do, without ever
          asking to be looked at. `scale-110` hides the transparent edge the
          blur pulls in from outside the box. */}
      <div className="from-background/78 via-background/58 to-background/32 absolute inset-0 bg-gradient-to-br" />
    </div>
  );
}
