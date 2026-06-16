"use client";

import { Plus } from "lucide-react";
import { resolveIcon } from "@/lib/icon-registry";
import type { Tag } from "@/lib/plan-meta";
import { PlanItemCard, type DayItem, type Member } from "./plan-item-card";

/** One time-of-day bucket (Sáng/Trưa/Chiều/Tối): label, soft connector line,
 *  its items, and an inline "add to this bucket" affordance.
 *
 *  The `icon` prop accepts a registry key (e.g. "sunrise") or any unknown/legacy
 *  string — resolveIcon handles the fallback so the UI never crashes. */
export function BucketSection({
  label,
  icon,
  items,
  date,
  members,
  palette,
  locationNames,
  onAdd,
  onEdit,
  onSaveAsMemory,
}: {
  label: string;
  /** Registry key (e.g. "sunrise") — unknown values render the fallback icon. */
  icon: string;
  items: DayItem[];
  date: string;
  members: Member[];
  palette: Tag[];
  locationNames: Record<string, string>;
  onAdd: () => void;
  onEdit: (item: DayItem) => void;
  onSaveAsMemory: (item: DayItem) => void;
}) {
  const BucketIcon = resolveIcon(icon);

  return (
    <section className="relative">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
          <BucketIcon className="h-4 w-4 opacity-70" />
          {label}
          <span className="text-xs font-normal opacity-70">({items.length})</span>
        </h3>
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Thêm việc buổi ${label}`}
          className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Thêm
        </button>
      </div>
      <div className="space-y-2 border-l-2 border-dashed border-border pl-3">
        {items.length === 0 ? (
          <p className="text-muted-foreground py-1 text-xs">—</p>
        ) : (
          items.map((it) => (
            <PlanItemCard
              key={it.id}
              item={it}
              date={date}
              members={members}
              palette={palette}
              locationName={it.locationId ? locationNames[it.locationId] : undefined}
              onEdit={() => onEdit(it)}
              onSaveAsMemory={() => onSaveAsMemory(it)}
            />
          ))
        )}
      </div>
    </section>
  );
}
