/**
 * Vietnamese text folding, in one place.
 *
 * Extracted from the search router rather than reimplemented next to it: two
 * copies of one matching rule drift, and a search that folds diacritics one way
 * in global search and another way in an address picker is confusing in a way
 * nobody reports as a bug — they just conclude the search "doesn't work".
 */

/** Drop combining marks (and the standalone đ/Đ, which never decomposes). */
export function toBaseLetters(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d");
}

/** Fold for comparison: base letters, lowercase, collapsed whitespace. */
export function foldForSearch(s: string): string {
  return toBaseLetters(s).toLowerCase().replace(/\s+/g, " ").trim();
}
