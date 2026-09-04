"use client";

// Shared shell for every card on the "Hôm nay" screen: accent medallion, title,
// optional right-aligned link. Keeping it here means the cards can't drift into
// six slightly different header treatments.

import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface HomeSectionProps {
  Icon: LucideIcon;
  title: string;
  /** Optional "see all" style link in the header. */
  link?: { href: string; label: string };
  /** Warmer treatment for the cards that have earned the attention. */
  highlight?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function HomeSection({
  Icon,
  title,
  link,
  highlight = false,
  className,
  children,
}: HomeSectionProps) {
  return (
    <Card
      className={cn(
        "space-y-3",
        /*
         * The tint rides in `style`, not in a class, because
         * `bg-gradient-to-br` and `bg-card` are the same group to
         * tailwind-merge — adding the gradient DELETED the card's own surface.
         * The highlighted card was left with no background colour at all: a
         * ten-percent wash floating over the page artwork, which is why its
         * text read as sunk while every plain card beside it stayed crisp.
         */
        highlight && "border-accent/25",
        className,
      )}
      style={
        highlight
          ? {
              backgroundImage:
                "linear-gradient(to bottom right, color-mix(in srgb, var(--gradient-from) 12%, transparent), color-mix(in srgb, var(--gradient-to) 12%, transparent))",
            }
          : undefined
      }
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            highlight ? "bg-accent text-accent-foreground" : "bg-accent-soft text-accent",
          )}
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" strokeWidth={1.8} />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-h2 font-semibold">{title}</h2>
        {link && (
          <Link
            href={link.href}
            className="text-accent hover:bg-accent-soft focus-visible:ring-ring/50 -mr-1 inline-flex min-h-10 shrink-0 items-center gap-0.5 rounded-lg px-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2"
          >
            {link.label}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
      {children}
    </Card>
  );
}

/**
 * Quiet inline prompt used when a section has nothing yet — warm one-liner plus
 * a link to the feature that fills it. Deliberately smaller than <EmptyState/>:
 * on this screen several of these can be on screen at once, and full-height
 * empty states would make a new couple's home look like a wall of nothing.
 */
export function SectionPrompt({
  text,
  action,
}: {
  text: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="space-y-2.5">
      <p className="text-muted-foreground text-sm">{text}</p>
      {action && (
        <Link
          href={action.href}
          className="border-border hover:bg-muted focus-visible:ring-ring/50 inline-flex min-h-10 items-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2"
        >
          {action.label}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
