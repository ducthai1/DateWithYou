"use client";

import { cn } from "@/lib/utils";

/**
 * The controls for "I don't know, you decide".
 *
 * Every one of these is a chip rather than a dropdown, for one reason: the
 * person using this screen has already said they cannot decide. A select asks
 * them to open something, read a list and choose — which is the decision they
 * just told us they did not want to make. A row of chips can be answered, or
 * ignored entirely, with one thumb.
 */

export function Chip({
  label,
  selected,
  onClick,
  size = "sm",
  className,
}: {
  label: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  size?: "sm" | "lg";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-full border font-medium transition-all active:scale-95",
        size === "lg"
          ? "px-5 py-3 text-base"
          : "px-3.5 py-2 text-sm",
        selected
          ? "border-accent bg-accent text-accent-foreground shadow-elev-1"
          : "border-border bg-card text-muted-foreground hover:border-accent hover:text-accent-ink",
        className,
      )}
      // A 44px target, because this screen is used one-handed on a phone.
      style={{ minHeight: 44 }}
    >
      {label}
    </button>
  );
}

export function ChipRow({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function toggleIn(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
