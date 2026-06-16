"use client";

// Reusable empty-state for any feature area. Uses the icon registry so icons
// are always theme-consistent Lucide SVGs rather than emoji strings.
// CTA is polymorphic: onClick uses Button; href uses a styled Link that matches
// Button's primary variant exactly — Button has no asChild/Slot support.

import Link from "next/link";
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
  className?: string;
}

// Shared primary-button classes — mirrors Button variant="primary" exactly so
// the link variant is visually identical without needing an asChild wrapper.
const PRIMARY_BTN =
  "inline-flex cursor-pointer items-center justify-center rounded-xl text-sm font-medium transition-all active:scale-[.98] h-11 px-4 focus-visible:ring-ring/50 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 bg-accent text-accent-foreground hover:bg-accent-hover shadow-sm";

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
export function EmptyState({ icon, title, subtitle, action, className }: EmptyStateProps) {
  const Icon = resolveIcon(icon);

  return (
    <>
      {/* Scoped keyframe — deduplicated by browser if multiple instances render */}
      <style>{FADE_STYLE}</style>

      <div
        className={cn(
          "es-fade-in flex flex-col items-center justify-center gap-4 py-14 text-center",
          className,
        )}
      >
        {/* Accent-soft medallion — flat (no elevation shadow), rounded-full */}
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent-soft">
          <Icon className="h-7 w-7 text-accent" strokeWidth={1.6} />
        </span>

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
