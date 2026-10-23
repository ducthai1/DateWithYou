"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The tick for one cell. The tap area is the full 40px button; the box drawn
 * inside is 22px — the hit target and the shape are kept apart on purpose, so
 * meeting the touch-size rule does not mean a checkbox the size of a stamp.
 */
export function NotebookCheck({
  done,
  label,
  onToggle,
  disabled = false,
}: {
  done: boolean;
  /** What is being ticked, for screen readers: "Trưa 12h: 230g bắp bò". */
  label: string;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className="focus-visible:ring-ring/50 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span
        className={cn(
          "flex h-[22px] w-[22px] items-center justify-center rounded-md border-2 transition-colors",
          // accent-foreground, not white: the honey and sage themes switch it to
          // ink because white on their accent falls under 3:1.
          done ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card",
        )}
      >
        {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
    </button>
  );
}
