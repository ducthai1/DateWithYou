"use client";

export { Chip } from "@/components/ui/chip";

/**
 * The controls for "I don't know, you decide".
 *
 * Every one of these is a chip rather than a dropdown, for one reason: the
 * person using this screen has already said they cannot decide. A select asks
 * them to open something, read a list and choose — which is the decision they
 * just told us they did not want to make. A row of chips can be answered, or
 * ignored entirely, with one thumb.
 */

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
