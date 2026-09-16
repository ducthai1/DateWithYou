import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Adds hover lift behaviour: translate-y -2px + elevated shadow.
   * Uses token-driven transition (--ease-spring, --dur-fast) so the lift feels
   * physical. Disabled automatically under prefers-reduced-motion via the
   * global guard in globals.css.
   */
  interactive?: boolean;
  /**
   * For a surface sitting over the artwork ground rather than over
   * `--background`.
   *
   * The resting treatment — a #E5E7EB hairline and 3% of black — was measured
   * against the flat off-white the app used to have everywhere. On top of
   * AppBackdrop's photograph it disappears: the centred card on /moi measured
   * 1.11:1 median separation from its surroundings, two thirds of its outline
   * under 1.20:1, and no measurable shadow at all. That is the "card floating
   * invisibly on a picture" look.
   *
   * What fixes it is the SHADOW, not the border. Measured at the rendered
   * pixel: the old #E5E7EB hairline came out at luminance 0.798 and a ring of
   * warm ink at 12% at 0.768 — a difference of 0.03, which is nothing. The
   * ground just outside the card is where the whole gain is (0.733 → 0.327).
   * So the ring stays modest and honest, and elev-float does the work.
   *
   * Opt-in rather than the default because most cards in the app sit near the
   * top-left, where the backdrop wash is at 86% and the resting treatment is
   * still correct — and heavier than necessary is its own kind of wrong.
   */
  floating?: boolean;
}

/**
 * Shared surface component.
 *
 * Default: resting warm-tinted shadow (--elev-1) on a white card bg.
 * interactive=true: adds pointer cursor + hover lift to --elev-2 elevation.
 * floating=true: ring + --elev-float, for a card over the artwork ground.
 *
 * Usage:
 *   <Card>static content</Card>
 *   <Card interactive onClick={…}>tappable card</Card>
 *   <Card floating>a card that sits on the picture, not on --background</Card>
 */
export function Card({ className, interactive = false, floating = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        // Base surface
        "bg-card rounded-xl border p-4",
        floating
          // Warm ink rather than the cool grey hairline — a tone match with
          // the shadow, not a contrast claim. It buys 0.03 of luminance; see
          // the note above for why that is fine and where the edge comes from.
          ? "border-[rgba(28,25,23,0.12)] shadow-elev-float"
          : "border-border shadow-elev-1",
        // Interactive variant: lift on hover using motion tokens
        interactive && "cursor-pointer",
        interactive && "transition-[transform,box-shadow]",
        interactive && !floating && "hover:-translate-y-0.5 hover:shadow-elev-2",
        interactive && floating && "hover:-translate-y-0.5",
        className,
      )}
      // Apply motion token durations via inline style so the transition
      // honours the CSS variables without coupling to arbitrary Tailwind values.
      style={
        interactive
          ? {
              transitionDuration: "var(--dur-fast)",
              transitionTimingFunction: "var(--ease-spring)",
            }
          : undefined
      }
      {...props}
    />
  );
}
