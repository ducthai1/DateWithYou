"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One tap instead of typing.
 *
 * Born on "Hôm nay đi đâu" — the screen for people who already said they
 * cannot decide — and now in every form that used to hand over an empty box
 * for something the app could offer: a kind of plan, a price, a date, an idea.
 * A row of chips can be answered, or ignored entirely, with one thumb.
 */
export function Chip({
  label,
  selected,
  onClick,
  icon: Icon,
  size = "sm",
  className,
}: {
  label: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  icon?: LucideIcon;
  size?: "sm" | "lg";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full border font-medium transition-all active:scale-95",
        size === "lg"
          ? "px-5 py-3 text-base"
          : "px-3.5 py-2 text-sm",
        selected
          ? "border-accent bg-accent text-accent-foreground shadow-elev-1"
          : "border-border bg-card text-muted-foreground hover:border-accent hover:text-accent-ink",
        className,
      )}
      // A 44px target, because these are tapped one-handed on a phone.
      style={{ minHeight: 44 }}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      {label}
    </button>
  );
}
