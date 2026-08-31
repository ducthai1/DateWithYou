"use client";

// Reusable empty-state for any feature area. Uses the icon registry so icons
// are always theme-consistent Lucide SVGs rather than emoji strings.
// CTA is polymorphic: onClick uses Button; href uses a styled Link that matches
// Button's primary variant exactly — Button has no asChild/Slot support.

import Image from "next/image";
import Link from "next/link";
import { useTone } from "@/components/theme/tone-provider";
import { artIsTransparent, artSrc, type ArtName, type SpotName } from "@/lib/tone";
import { SpotArt } from "@/components/theme/tone-art";
import { resolveIcon } from "@/lib/icon-registry";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Action =
  | { label: string; onClick: () => void; href?: never }
  | { label: string; href: string; onClick?: never };

interface EmptyStateProps {
  /** Registry key for the medallion icon (falls back to MapPin for unknown keys). */
  icon?: string;
  /** Short heading — serif, h2-scale. */
  title: string;
  /** Supporting sentence shown below the title. */
  subtitle?: string;
  /** Optional primary CTA. Supports both onClick handler and next/link href. */
  action?: Action;
  /**
   * Show a piece of the brand artwork instead of the icon medallion.
   *
   * Only where a picture says something the icon cannot — an empty map, an
   * empty scrapbook. The image follows the current tone, and falls back to
   * whichever tone that piece exists in.
   */
  art?: ArtName;
  /**
   * How much room the artwork gets. "sm" (default) is the medallion-sized
   * picture that stands in for the icon. "lg" is for screens where the empty
   * state IS the screen — /search before anything is typed, a space with
   * nothing in it yet — where 352px marooned in an empty viewport reads as an
   * error rather than an invitation.
   */
  artSize?: "sm" | "lg";
  /**
   * A spot illustration instead of the icon medallion — for the empty states
   * `art` is too big for: a kanban column, a section nested inside a page that
   * already has its own art. A 16:9 scene forced into that box crops to a
   * smear; a spot is one object and reads fine that small. Ignored when `art`
   * is set (pass one or the other, never both).
   */
  spot?: SpotName;
  /** Reuses the `art` size steps: "sm" (default, 112px) for a column or a
   *  section among other content, "lg" (176px) where this empty state is the
   *  whole tab. Both are still far under the 352px `art` gets — a spot is one
   *  object, not a scene, and looks like a stray sticker if blown up that big. */
  spotSize?: "sm" | "lg";
  className?: string;
}

// Shared primary-button classes — mirrors Button variant="primary" exactly so
// the link variant is visually identical without needing an asChild wrapper.
const PRIMARY_BTN =
  "btn-sheen inline-flex cursor-pointer items-center justify-center rounded-xl text-sm font-medium transition-all active:scale-[.98] h-11 px-4 focus-visible:ring-ring/50 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 bg-accent text-accent-foreground hover:bg-accent-hover shadow-sm";

// Keyframe injected as a scoped <style> tag so we don't touch globals.css.
// Uses the project's --ease-spring / --dur tokens from :root.
const FADE_STYLE = `
@keyframes es-fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.es-fade-in {
  animation: es-fade-in var(--dur, 250ms) var(--ease-spring, cubic-bezier(0.16,1,0.3,1)) both;
}
`;

/**
 * Centered empty-state with an accent-soft medallion, serif title, muted
 * subtitle, and an optional primary CTA. Single light fade on mount via the
 * project's spring tokens (--ease-spring / --dur). All colours come from CSS
 * custom properties — fully theme-aware, no hardcoded hex.
 */
export function EmptyState({ icon, title, subtitle, action, art, artSize = "sm", spot, spotSize = "sm", className }: EmptyStateProps) {
  const Icon = resolveIcon(icon);
  const { tone } = useTone();

  return (
    <>
      {/* Scoped keyframe — deduplicated by browser if multiple instances render */}
      <style>{FADE_STYLE}</style>

      <div
        className={cn(
          "es-fade-in flex flex-col items-center justify-center gap-4 py-14 text-center",
          // Its own surface. The empty state used to be text laid straight onto
          // the page, which meant straight onto the artwork ground — measured
          // between 3.4 and 4.4:1, under the 4.5 body copy needs. A card also
          // reads better: the picture belongs AROUND the message, not through
          // the middle of it.
          "border-border/60 bg-card/92 mx-auto max-w-3xl rounded-3xl border px-6 shadow-sm backdrop-blur-sm",
          className,
        )}
      >
        {/* Artwork when one was chosen for this screen, medallion otherwise. */}
        {art ? (
          <Image
            src={artSrc(art, tone)}
            alt=""
            width={640}
            height={360}
            aria-hidden="true"
            // Without this next/image assumes 100vw and picks the 1920px file
            // for a box that is never wider than 22rem — measured 1920w served
            // into a 352px slot. The cap below is the real upper bound, so say
            // so and let the 384/768 variants do the work.
            sizes={artSize === "lg" ? "(max-width: 640px) 92vw, 560px" : "352px"}
            className={cn(
              "h-auto w-full object-contain",
              // Every picture in the app carries a shadow; these were the ones
              // still sitting flat on the page. A cut-out gets it on its own
              // silhouette, an opaque one on its rounded box.
              artIsTransparent(art, tone)
                ? "drop-shadow-[0_14px_28px_rgba(59,50,42,0.22)]"
                : "rounded-2xl shadow-[0_12px_28px_rgba(59,50,42,0.16)]",
              artSize === "lg" ? "max-w-[min(35rem,92%)]" : "max-w-[min(22rem,80%)]",
            )}
          />
        ) : spot ? (
          <div
            className={cn("relative shrink-0", spotSize === "lg" ? "h-44 w-44" : "h-28 w-28")}
          >
            <SpotArt name={spot} sizes={spotSize === "lg" ? "176px" : "112px"} />
          </div>
        ) : (
          <span className="bg-accent-soft flex h-16 w-16 shrink-0 items-center justify-center rounded-full">
            <Icon className="text-accent h-7 w-7" strokeWidth={1.6} />
          </span>
        )}

        {/* Title: serif, h2-scale weight */}
        <p className="font-serif text-h2 font-semibold leading-snug">{title}</p>

        {/* Subtitle: small muted body */}
        {subtitle && (
          <p className="max-w-xs text-sm text-muted-foreground">{subtitle}</p>
        )}

        {/* CTA — polymorphic: onClick via Button, href via styled Link */}
        {action && (
          action.href ? (
            <Link href={action.href} className={PRIMARY_BTN}>
              {action.label}
            </Link>
          ) : (
            <Button onClick={action.onClick}>{action.label}</Button>
          )
        )}
      </div>
    </>
  );
}
