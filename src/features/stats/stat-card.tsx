"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One warm number. Deliberately has no "vs" slot and no trend arrow: these
 * cards describe what the two of them built together, so there is never a
 * second value to measure the first against.
 */
export function StatCard({
  Icon,
  label,
  value,
  hint,
  className,
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-muted/40 flex flex-col justify-center rounded-2xl p-4",
        className,
      )}
    >
      <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="leading-tight">{label}</span>
      </div>
      <p className="text-accent text-xl font-bold tracking-tight">{value}</p>
      {hint && (
        <p className="text-muted-foreground mt-1 text-[10px] leading-tight">{hint}</p>
      )}
    </div>
  );
}
