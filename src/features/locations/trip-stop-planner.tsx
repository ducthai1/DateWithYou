"use client";

import { MapPin, Plus, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * One stop on the way to the destination.
 *
 * `partner` resolves to the other person's live position at the moment the
 * trip starts, which is why it carries no coordinates of its own.
 */
export type PlannedStop =
  | { kind: "partner" }
  | { kind: "saved"; id: string; name: string; lat: number; lng: number };

type SavedPlace = { id: string; name: string; geo?: { lat: number; lng: number } | null };

/**
 * The numbered route: you, the stops in between, the destination last.
 *
 * Lifted out of the go-together dialog so a solo trip can plan the same way.
 * Planning stops was never a two-person idea — a detour for petrol or a
 * bánh mì on the way is exactly as useful alone — it had simply only ever
 * been built inside the dialog that invites someone.
 *
 * Leave `partnerLocation` unset and the "pick them up" option disappears,
 * which is what makes the same component correct for one person and for a
 * space that has only one member.
 */
export function TripStopPlanner({
  stops,
  onChange,
  pickerOpen,
  onPickerOpenChange,
  savedPlaces,
  destinationId,
  destinationName,
  partnerLocation,
}: {
  stops: PlannedStop[];
  onChange: (next: PlannedStop[]) => void;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  savedPlaces: SavedPlace[];
  destinationId: string | null;
  destinationName: string;
  partnerLocation?: { lat: number; lng: number } | null;
}) {
  const hasPartnerStop = stops.some((s) => s.kind === "partner");
  const usedSavedIds = new Set(
    stops.filter((s): s is Extract<PlannedStop, { kind: "saved" }> => s.kind === "saved").map((s) => s.id),
  );
  const savedOptions = savedPlaces.filter(
    (l) => l.geo && l.id !== destinationId && !usedSavedIds.has(l.id),
  );
  const canAddPartner = !!partnerLocation && !hasPartnerStop;

  return (
    <div className="border-border/50 bg-muted/30 space-y-3 rounded-xl border p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
          1
        </div>
        <span className="text-sm font-medium">Bạn xuất phát từ đây</span>
      </div>

      {stops.map((s, i) => {
        const isPartner = s.kind === "partner";
        return (
          <div key={isPartner ? "partner" : s.id} className="ml-3 border-l-2 border-rose-200 py-1 pl-3">
            <div className="relative flex items-center justify-between overflow-hidden rounded-lg border border-rose-100 bg-rose-50 p-3 text-rose-700 shadow-sm">
              <div className="absolute left-0 top-0 h-full w-1 bg-[var(--accent)]" />
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-200 text-xs font-bold text-rose-700 shadow-sm">
                  {i + 2}
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {isPartner ? "Ghé đón người kia" : s.name}
                  </span>
                  <span className="block text-[11px] text-[var(--accent)]/80">
                    {isPartner ? "Vị trí trực tiếp" : "Điểm dừng"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                aria-label={`Bỏ điểm dừng ${isPartner ? "đón người kia" : s.name}`}
                onClick={() => onChange(stops.filter((_, j) => j !== i))}
                className="shrink-0 rounded-full p-1 transition-colors hover:bg-rose-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}

      {!pickerOpen ? (
        <div className="border-muted-foreground/30 ml-3 border-l-2 border-dashed py-1 pl-3">
          <Button
            variant="ghost"
            className="bg-background/50 text-muted-foreground hover:text-foreground w-full justify-start border border-dashed"
            onClick={() => onPickerOpenChange(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            {stops.length === 0
              ? canAddPartner
                ? "Ghé đón người kia / thêm điểm dừng"
                : "Thêm điểm dừng dọc đường"
              : "Thêm điểm dừng"}
          </Button>
        </div>
      ) : (
        <div className="ml-3 space-y-1.5 border-l-2 border-rose-200 py-1 pl-3">
          <div className="border-border bg-background max-h-44 space-y-1 overflow-y-auto rounded-lg border p-2">
            {canAddPartner && (
              <button
                type="button"
                onClick={() => { onChange([...stops, { kind: "partner" }]); onPickerOpenChange(false); }}
                className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors hover:bg-[var(--accent)]/10"
              >
                <UserRound className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                <span className="font-medium">Vị trí trực tiếp của người kia</span>
              </button>
            )}
            {savedOptions.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => {
                  onChange([...stops, { kind: "saved", id: l.id, name: l.name, lat: l.geo!.lat, lng: l.geo!.lng }]);
                  onPickerOpenChange(false);
                }}
                className="hover:bg-muted flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors"
              >
                <MapPin className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="truncate">{l.name}</span>
              </button>
            ))}
            {!canAddPartner && savedOptions.length === 0 && (
              <p className="text-muted-foreground p-2 text-xs">Không còn địa điểm nào để thêm.</p>
            )}
          </div>
          <Button variant="ghost" className="text-muted-foreground w-full" onClick={() => onPickerOpenChange(false)}>
            Đóng
          </Button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-600">
          {stops.length + 2}
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-muted-foreground block text-xs">Đích đến cuối cùng</span>
          <span className="block truncate text-sm font-semibold">{destinationName}</span>
        </div>
      </div>
    </div>
  );
}
