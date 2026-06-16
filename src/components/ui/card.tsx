import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Adds hover lift behaviour: translate-y -2px + elevated shadow.
   * Uses token-driven transition (--ease-spring, --dur-fast) so the lift feels
   * physical. Disabled automatically under prefers-reduced-motion via the
   * global guard in globals.css.
   */
  interactive?: boolean;
}

/**
 * Shared surface component.
 *
 * Default: resting warm-tinted shadow (--elev-1) on a white card bg.
 * interactive=true: adds pointer cursor + hover lift to --elev-2 elevation.
 *
 * Usage:
 *   <Card>static content</Card>
 *   <Card interactive onClick={…}>tappable card</Card>
 */
export function Card({ className, interactive = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        // Base surface
        "border-border bg-card rounded-xl border p-4",
        // Resting elevation — warm-tinted, not flat grey
        "shadow-elev-1",
        // Interactive variant: lift on hover using motion tokens
        interactive && "cursor-pointer",
        interactive && "transition-[transform,box-shadow]",
        interactive && "hover:-translate-y-0.5 hover:shadow-elev-2",
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
