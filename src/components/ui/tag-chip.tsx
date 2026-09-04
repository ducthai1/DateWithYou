"use client";

import { trpc } from "@/lib/trpc";
import { resolveIcon } from "@/lib/icon-registry";
import { cn } from "@/lib/utils";
import { readableInk } from "@/lib/plan-meta";

/**
 * A tag, wearing its own colour.
 *
 * The picker paints each tag from the palette, and every place that displayed a
 * saved tag repainted it flat in the accent instead — so a colour chosen while
 * writing was gone by the time anyone read it back, and six different tags all
 * looked like the same one. The colour is the point of a tag; it is what makes
 * a list scannable without reading.
 *
 * Matches the picker's SELECTED chip on purpose: the same tag should look the
 * same whether it is being chosen or being read.
 *
 * A name with no palette entry keeps the old flat treatment — that happens for
 * a tag typed before the palette existed, and inventing a colour for it would
 * make two unrelated tags look related.
 */
export function TagChip({ name, className }: { name: string; className?: string }) {
  const tags = trpc.space.tags.useQuery();
  const tag = (tags.data ?? []).find(
    (t) => t.name.toLowerCase() === name.toLowerCase(),
  );
  const Icon = tag?.icon ? resolveIcon(tag.icon) : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        tag ? "border-transparent" : "bg-accent-soft text-accent border-transparent",
        className,
      )}
      style={
        tag
          ? { backgroundColor: tag.color, borderColor: tag.color, color: readableInk(tag.color) }
          : undefined
      }
    >
      {Icon && <Icon className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />}
      {name}
    </span>
  );
}
