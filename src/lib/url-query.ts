/**
 * Screen state that lives in the query string.
 *
 * A tab, a filter or an open card held only in React state is gone the moment
 * the page reloads: the library came back on "Nhạc" whatever tab it had been
 * on, with the tag filter and the open recipe dropped. Kept in the URL, the
 * same view survives a reload, a shared link, and the back link out of the
 * player.
 *
 * Pure so node can test it; the hook that reads and writes the live URL is
 * `@/hooks/use-query-state`.
 */

/** Keys to set; `null`, `undefined` or `""` removes the key instead. */
export type QueryPatch = Record<string, string | null | undefined>;

/** `href` with every key in `patch` applied. Path and hash are kept. */
export function withQuery(href: string, patch: QueryPatch): string {
  // The base only lets URL parse a relative href; it never reaches the output.
  const url = new URL(href, "http://local");
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === "") url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  return url.pathname + url.search + url.hash;
}

/** The path of an href, without its query or hash. */
export function pathOf(href: string): string {
  return href.split(/[?#]/)[0];
}

/** `YYYY-MM` → `{ year, month }` with a 1-based month, or null if malformed. */
export function parseMonthParam(raw: string | null): { year: number; month: number } | null {
  const m = raw?.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? { year, month } : null;
}

export function formatMonthParam({ year, month }: { year: number; month: number }): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** A `YYYY-MM-DD` day key, or null for anything else. */
export function dayParam(raw: string | null): string | null {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}
