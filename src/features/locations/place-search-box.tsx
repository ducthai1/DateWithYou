"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2, MapPin, Search as SearchIcon, SlidersHorizontal, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { LatLng } from "@/lib/maps";

/**
 * The map's search box: filters saved pins as you type, and offers real places
 * underneath.
 *
 * What this replaces was invented rather than borrowed. Typing filtered the
 * saved list, and finding somewhere new meant noticing a separate button and
 * pressing it, which then geocoded a single guess. Every map application solves
 * this the same way and people already know the shape of it: type, get a list,
 * pick one. That is what this does.
 *
 * Built to the WAI-ARIA combobox pattern rather than a bespoke dropdown, so the
 * keys people already press work — Down and Up move through suggestions, Enter
 * takes the active one, Escape closes without choosing, Tab leaves. The active
 * option is announced through aria-activedescendant, which keeps real focus in
 * the input where the text is.
 *
 * Suggestions are biased toward wherever the map is looking. Without that,
 * "highland" answers with a café in Lào Cai, 1,500km from someone in Saigon,
 * purely because it sorted first.
 */

/** Below this, suggestions are noise — "p" matches half the country. */
const MIN_CHARS = 2;
/** Long enough that a normal typing burst is one request, short enough to feel live. */
const DEBOUNCE_MS = 300;
/** Bias point is rounded to this, in degrees (~5km) — see biasKey below. */
const BIAS_GRID = 0.05;

/** Metres → the short form people read on a result row. */
function fmtAway(m: number): string {
  if (m < 950) return `${Math.round(m / 10) * 10} m`;
  if (m < 10000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 1000)} km`;
}

export function PlaceSearchBox({
  value,
  onValueChange,
  onPickPlace,
  near,
  filterCount,
  onToggleFilters,
  filtersOpen,
}: {
  value: string;
  onValueChange: (next: string) => void;
  /** A place was chosen: drop a draft pin and open the form. */
  onPickPlace: (place: { name: string; url: string | null } & LatLng) => void;
  /** Where the map is looking, used to bias results. */
  near?: LatLng | null;
  filterCount: number;
  onToggleFilters: () => void;
  filtersOpen: boolean;
}) {
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const [debounced, setDebounced] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [resolving, setResolving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [value]);

  /*
   * Snap the bias point to a coarse grid before it reaches the query.
   *
   * `near` is part of the cache key, and it comes from the map centre, which
   * changes after every pan. Without this, nudging the map two streets over
   * while there is text in the box is a fresh key and therefore a fresh
   * request — for results that cannot differ, because the bias radius is 25km
   * and the map moved a few hundred metres. Rounding to ~0.05° (~5km) collapses
   * ordinary panning onto one key and keeps the shift far inside the radius.
   */
  const biasKey = useMemo(() => {
    if (!near) return null;
    const snap = (n: number) => Math.round(n / BIAS_GRID) * BIAS_GRID;
    return { lat: snap(near.lat), lng: snap(near.lng) };
  }, [near]);

  const suggestions = trpc.location.suggestPlaces.useQuery(
    { query: debounced, near: biasKey },
    {
      enabled: debounced.length >= MIN_CHARS,
      // Repeats and backspaces come from cache instead of another round trip.
      staleTime: 5 * 60 * 1000,
    },
  );
  const items = useMemo(() => suggestions.data ?? [], [suggestions.data]);

  // Reset the highlight whenever the result set changes, or Enter would take
  // whatever happened to sit at the old index.
  useEffect(() => setActive(-1), [debounced]);

  // Close when focus or a click leaves the box.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function choose(index: number) {
    const item = items[index];
    if (!item || resolving) return;
    setResolving(true);
    setOpen(false);
    try {
      // The coordinate came with the suggestion — text search returns geometry
      // inline — so this no longer needs a details round trip at all. It still
      // asks for one thing details has and search does not: the place's own
      // link, which is worth a call for the single result actually chosen.
      onPickPlace({ lat: item.lat, lng: item.lng, name: item.main, url: null });
      const detail = await utils.location.placeDetail
        .fetch({ placeId: item.placeId })
        .catch(() => null);
      if (detail?.url) {
        onPickPlace({ lat: detail.lat, lng: detail.lng, name: detail.name || item.main, url: detail.url });
      }
    } finally {
      setResolving(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (!open || items.length === 0) {
      // Enter with nothing to pick still means "look this up", the behaviour
      // that existed before suggestions did.
      if (e.key === "ArrowDown" && items.length > 0) setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      void choose(active);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  /** Typed text has not reached the query yet, so no verdict is available. */
  const settling = value.trim() !== debounced || suggestions.isFetching;

  const showList = open && debounced.length >= MIN_CHARS;

  return (
    <div ref={boxRef} className="relative">
      <div className="relative rounded-xl shadow-lg lg:shadow-none">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onValueChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          // Short enough to clear the filter and clear buttons that sit inside the
          // field's right padding. Two longer versions were cut mid-word.
          placeholder="Tìm quán hoặc chỗ mới…"
          aria-label="Tìm địa điểm"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          className="border-border bg-card focus:border-accent focus:ring-ring/30 h-10 w-full rounded-xl border pl-9 pr-20 text-sm outline-none focus:ring-2 lg:pr-20"
        />

        {resolving ? (
          <Loader2 className="text-muted-foreground absolute right-9 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" />
        ) : (
          <button
            type="button"
            onClick={onToggleFilters}
            aria-expanded={filtersOpen}
            aria-label="Bộ lọc"
            className={cn(
              "absolute right-9 top-1/2 flex h-7 -translate-y-1/2 items-center gap-1 rounded-lg px-2 text-[12px] font-medium transition-colors",
              filterCount > 0
                ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {filterCount > 0 ? filterCount : null}
          </button>
        )}

        {value ? (
          <button
            type="button"
            onClick={() => {
              onValueChange("");
              setOpen(false);
              inputRef.current?.focus();
            }}
            aria-label="Xoá tìm kiếm"
            className="text-muted-foreground hover:text-foreground absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {/* Announced to screen readers without being drawn — the list's own
          contents are visual, but "how many results" is not conveyed by them. */}
      <span className="sr-only" role="status" aria-live="polite">
        {showList ? (settling ? "Đang tìm địa điểm" : `${items.length} gợi ý`) : ""}
      </span>

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Địa điểm gợi ý"
          className="border-border bg-card absolute inset-x-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-xl border py-1 shadow-xl"
        >
          {/*
            "still working" covers the debounce window too, not just the request.
            Between a keystroke and the query starting, isFetching is false and
            there is no data — which rendered "no such place" for a beat every
            single time, telling people their search had failed while it had not
            yet begun.
          */}
          {settling || (suggestions.isFetching && items.length === 0) ? (
            <li className="text-muted-foreground px-3 py-3 text-center text-sm">
              Đang tìm…
            </li>
          ) : items.length === 0 ? (
            <li className="text-muted-foreground px-3 py-3 text-center text-sm">
              Không tìm thấy chỗ nào tên như vậy
            </li>
          ) : (
            items.map((item, i) => (
              <li key={item.placeId} id={optionId(i)} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  // Pointer down, not click: click fires after blur, which would
                  // have closed the list out from under the tap.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void choose(i);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors",
                    i === active ? "bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  <MapPin className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.main}</span>
                    {item.secondary ? (
                      <span className="text-muted-foreground block truncate text-xs">
                        {item.secondary}
                      </span>
                    ) : null}
                  </span>
                  {/* How far, because a list of names cannot answer "which of
                      these is near me" — which is the whole question. Results
                      arrive nearest-first for the same reason. */}
                  <span className="text-muted-foreground mt-0.5 shrink-0 text-xs tabular-nums">
                    {fmtAway(item.distanceM)}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
