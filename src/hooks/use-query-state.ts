"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { withQuery, type QueryPatch } from "@/lib/url-query";
import { noteVisit } from "@/lib/back-trail";

/**
 * Screen state kept in the query string, so a reload lands on the same tab,
 * filter and open card instead of each screen's defaults. See `@/lib/url-query`.
 *
 * Read through useSyncExternalStore rather than useSearchParams, which would
 * drag a Suspense boundary into every page using it (memory-timeline avoids it
 * for the same reason). The server snapshot is "no params", so the first paint
 * matches the server and the real values arrive in the render right after
 * hydration — under the boot veil on a reload.
 */

const CHANGE = "vivu:query-change";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

/**
 * Set query params in place: no navigation, no new history entry.
 *
 * The state argument is `null` on purpose. Next patches history.replaceState
 * and re-syncs its router with the new URL only when the state passed in is not
 * its own; handing it `history.state` would skip that, and the router's next
 * update would write its stale URL back over these params.
 */
export function replaceQuery(patch: QueryPatch): void {
  const here = window.location.pathname + window.location.search + window.location.hash;
  const next = withQuery(here, patch);
  if (next === here) return;
  window.history.replaceState(null, "", next);
  noteVisit(window.location.pathname + window.location.search);
  window.dispatchEvent(new Event(CHANGE));
}

export function useQueryParam(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(key),
    () => null,
  );
}

/** One of `values`; anything else in the URL reads as `fallback`, which is kept out of it. */
export function useQueryEnum<T extends string>(
  key: string,
  values: readonly T[],
  fallback: T,
): [T, (next: T) => void] {
  const raw = useQueryParam(key);
  const value = raw !== null && (values as readonly string[]).includes(raw) ? (raw as T) : fallback;
  const set = useCallback(
    (next: T) => replaceQuery({ [key]: next === fallback ? null : next }),
    [key, fallback],
  );
  return [value, set];
}

/** A free-text param; `""` means absent. */
export function useQueryString(key: string): [string, (next: string) => void] {
  const value = useQueryParam(key) ?? "";
  const set = useCallback((next: string) => replaceQuery({ [key]: next || null }), [key]);
  return [value, set];
}

/**
 * A text box whose value follows the URL. The box updates on every keystroke;
 * the URL catches up once typing pauses, so a reload mid-word loses at most the
 * last `delay` ms rather than every keystroke rewriting history.
 */
export function useQueryText(key: string, delay = 300): [string, (next: string) => void] {
  const fromUrl = useQueryParam(key) ?? "";
  // null = nothing typed yet on this page, so the box shows what the URL says.
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => {
    if (draft === null) return;
    const id = window.setTimeout(() => replaceQuery({ [key]: draft.trim() || null }), delay);
    return () => window.clearTimeout(id);
  }, [key, draft, delay]);
  return [draft ?? fromUrl, setDraft];
}
