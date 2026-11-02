/**
 * Amounts of đồng, as people type and say them.
 *
 * Every money field used to be a bare `type="number"`: "500000" with nothing
 * to tell 50.000 from 500.000 at a glance, and on iOS a keypad with no
 * thousands at all. These are the pieces behind MoneyInput — the dotted
 * display, a forgiving parse, and the "200k" / "1,5tr" people actually say.
 */

/** Digits only, so "500.000", "500,000 đ" and "500000" are the same amount. Empty is null, not 0. */
export function parseMoney(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits.slice(0, 13));
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * The amount after one keystroke in a field that shows "1.000.000".
 *
 * The dots are drawn by the field, so backspacing over one removes nothing the
 * amount is made of — the field redraws the same "1.000" and the key looks
 * dead. When a delete leaves the digits unchanged, it is taken as meaning the
 * digit beside the dot: the one before the caret for Backspace, after it for
 * Delete. `caret` is where the caret sits in `raw`, after the edit.
 */
export function editMoney(prev: number | null, raw: string, caret: number | null, inputType?: string): number | null {
  const next = parseMoney(raw);
  const prevDigits = prev == null ? "" : String(prev);
  const nextDigits = next == null ? "" : String(next);
  const deleting = inputType === "deleteContentBackward" || inputType === "deleteContentForward";
  if (!deleting || nextDigits !== prevDigits || caret == null || !prevDigits) return next;
  const before = raw.slice(0, caret).replace(/\D/g, "").length;
  const at = inputType === "deleteContentBackward" ? before - 1 : before;
  if (at < 0 || at >= prevDigits.length) return next;
  return parseMoney(prevDigits.slice(0, at) + prevDigits.slice(at + 1));
}

/** "500.000" — Vietnamese grouping, independent of the browser's locale. */
export function formatMoney(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** "200k", "1tr", "1,5tr" — for chips, where a whole number does not fit. */
export function shortMoney(n: number): string {
  if (n >= 1_000_000) {
    const tr = Math.round((n / 1_000_000) * 10) / 10;
    return `${String(tr).replace(".", ",")}tr`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}
