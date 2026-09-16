import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/**
 * A whole screen that is one panel, centred, with nothing else on it.
 *
 * `/moi/[code]` is the only kind of screen like this: somebody arrives from a
 * message, is told one thing, and taps once. It has no nav, no header band and
 * no page column, so it is the one layout that cannot borrow its readability
 * from any of them.
 *
 * Which is how it ended up as the worst-looking screen in the app. AppBackdrop
 * washes its artwork heaviest at the top-left — 86% — because that is where
 * every OTHER screen puts its heading, and thins to 52% at the bottom right
 * "where cards do the covering". A panel centred in the viewport lands in the
 * middle of that ramp, on the raw picture, and a white card with a #E5E7EB
 * hairline on a pale photograph measured 1.11:1 median edge separation: two
 * thirds of its outline was, to a camera, simply not there.
 *
 * Three things fix it, and they are deliberately not "turn the wash up". The
 * wash is global; cranking it flattens the artwork on every screen to rescue
 * this one, and AppBackdrop's own comments record that being tried and
 * abandoned ("about 1.7% of the picture surviving at the top left").
 *
 *  1. A pool of warm shade under the panel only. Local, so the picture keeps
 *     its strength out at the edges of the viewport where nothing is read.
 *  2. `floating` on the Card — a shadow built to make an edge rather than a
 *     tint. (The ring that comes with it is a tone match, not a contrast
 *     device: measured at the pixel it moves the boundary by 0.03 of
 *     luminance. The shadow and the pool are what carry it.)
 *  3. Room. The panel was `max-w-sm` marooned in the middle of a 1280px
 *     window, which is most of a desktop screen spent on wallpaper.
 */
export function StandaloneScreen({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center px-5 py-10">
      {/*
        The pool.

        Warm ink rather than more --background: a paler ground under a white
        card buys calm and LOSES the edge, because luminance ratios compress as
        they approach white. Shading down instead buys both — the panel reads
        as lit, and the ratio moves the right way.

        An ellipse, wider than tall, so it reads as light falling across a
        surface rather than as a circular spotlight with the panel in a hole.
        `-z-10` puts it on the same layer as AppBackdrop's wash, above the
        picture and below everything in flow.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 120% 78% at 50% 48%, rgba(28,25,23,0.13) 0%, rgba(28,25,23,0.09) 38%, rgba(28,25,23,0.03) 68%, rgba(28,25,23,0) 100%)",
        }}
      />
      <Card
        floating
        className={cn(
          "flex w-full max-w-md flex-col items-center gap-5 rounded-2xl p-7 text-center sm:p-8",
          className,
        )}
      >
        {children}
      </Card>
    </main>
  );
}
