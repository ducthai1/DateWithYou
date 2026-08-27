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

const VN_FORMS: Record<string, string> = {
  a: "aàáảãạăằắẳẵặâầấẩẫậ",
  d: "dđ",
  e: "eèéẻẽẹêềếểễệ",
  i: "iìíỉĩị",
  o: "oòóỏõọôồốổỗộơờớởỡợ",
  u: "uùúủũụưừứửữự",
  y: "yỳýỷỹỵ",
};

// Both cases are listed explicitly rather than leaning on the `i` flag alone:
// MongoDB's case-insensitive matching of non-ASCII code points depends on the
// server's PCRE build, and a wrong guess would silently drop accented hits.
const VN_CLASS: Record<string, string> = Object.fromEntries(
  Object.entries(VN_FORMS).map(([base, forms]) => [
    base,
    `[${forms}${forms.toUpperCase()}]`,
  ]),
);

const REGEX_META = /[.*+?^${}()|[\]\\]/;

/**
 * Compile the user's query into a safe, accent-tolerant substring pattern.
 * Returns null when nothing matchable is left (e.g. a lone combining mark),
 * which the caller treats as "no results" rather than "match everything".
 *
 * Shared rather than duplicated. Two accent-tolerant matchers in one codebase
 * drift, and the symptom is not an error — a place found by global search but
 * not by the filter on its own page just reads as "search is broken".
 */
export function buildPattern(raw: string): string | null {
  const base = toBaseLetters(raw).toLowerCase();
  let out = "";
  let gap = false;
  for (const ch of base) {
    if (/\s/.test(ch)) {
      gap = out.length > 0; // never emit a leading \s+
      continue;
    }
    if (gap) {
      out += "\\s+";
      gap = false;
    }
    out += VN_CLASS[ch] ?? (REGEX_META.test(ch) ? `\\${ch}` : ch);
  }
  return out.length > 0 ? out : null;
}

