/*
 * Naming someone in a caption.
 *
 * Derived from the text at save time rather than tracked as its own state. The
 * alternative — a list of ids maintained beside the words — drifts the moment
 * someone edits the sentence: delete the name and the mention survives, so the
 * other person is notified about a caption that no longer names them. Reading
 * the text is the only version that cannot disagree with what is on screen.
 */

import { foldForSearch } from "./vietnamese-text";

export type MentionMember = {
  id: string;
  /** What to call them now — the nickname if there is one. */
  name: string;
  /** The name their account was created with, still valid in older captions. */
  accountName?: string | null;
};

/** What gets inserted into the text when someone taps a name. */
export function mentionToken(name: string): string {
  return `@${name.trim()}`;
}

/**
 * The text with a name added at the end, ready to keep typing after.
 *
 * Only adds the separating space when there is not already whitespace there —
 * tapping the chip after a sentence that already ends in a space used to leave
 * two, which then showed up in the saved caption.
 */
export function appendMention(text: string, name: string): string {
  const lead = !text || /\s$/.test(text) ? "" : " ";
  return `${text}${lead}${mentionToken(name)} `;
}

/** Escapes a name so a regex built from it matches it literally. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type MentionRange = {
  start: number;
  end: number;
  id: string;
  /** The member's CURRENT name, whatever name the text used to reach them. */
  name: string;
};

/**
 * Where each named member sits in the text, in reading order.
 *
 * The highlight layer and the Backspace handler both read this. They have to:
 * if one of them worked out the boundaries on its own, a key press would delete
 * a span that does not match the one painted under the caret, and the mismatch
 * would only show up on the names where the two rules disagree.
 *
 * EVERY name a person has ever answered to is matched, not just the current
 * one. A caption written as "@Thuỳ Mai" does not stop naming her because the
 * two of them later agreed on "Bé Mai" — it would simply have decayed into a
 * stray "@" and a run of plain words, which is what happened the first time a
 * nickname was set. Whoever the text reached, the range reports their name as
 * it stands today, so a caller can show the current one.
 *
 * Longest alias first, so a person called "An" cannot claim the mention meant
 * for "An Nhiên". Case-insensitive because nobody capitalises consistently on
 * a phone, and a mention is worth finding either way.
 *
 * The character after the name must not be a letter or digit, which is what
 * keeps "@An" out of "@Anh" — Vietnamese needs the Unicode property escape
 * here, since \w would treat "ệ" as a non-word character and match halfway
 * through a name.
 */
export function findMentionRanges(text: string, members: MentionMember[]): MentionRange[] {
  if (!text) return [];

  type Alias = { id: string; name: string; alias: string };
  const aliases: Alias[] = [];
  for (const m of members) {
    if (!m.id) continue;
    const name = m.name?.trim();
    if (!name) continue;
    const seen = new Set<string>();
    for (const raw of [name, m.accountName]) {
      const alias = raw?.trim();
      if (!alias || seen.has(alias.toLowerCase())) continue;
      seen.add(alias.toLowerCase());
      aliases.push({ id: m.id, name, alias });
    }
  }
  // Longest across ALL aliases, not per member: a nickname of one person can be
  // a prefix of another person's account name.
  aliases.sort((a, b) => b.alias.length - a.alias.length);

  /*
   * Matches are CONSUMED, not just tested.
   *
   * Sorting longest-first is not enough on its own: the character after "An" in
   * "@An Nhiên" is a space, which passes the boundary check, so "An" matched
   * inside "An Nhiên" and both people were notified. Blanking each match before
   * looking for the next name is what stops a shorter name being found inside a
   * longer one that already claimed it — and the filler is the same length, so
   * every offset recorded here still points at the original string.
   */
  let rest = text;
  const out: MentionRange[] = [];
  for (const a of aliases) {
    const re = new RegExp(`@${escapeRe(a.alias)}(?![\\p{L}\\p{N}])`, "giu");
    let hit: RegExpExecArray | null;
    while ((hit = re.exec(rest)) !== null) {
      out.push({ start: hit.index, end: hit.index + hit[0].length, id: a.id, name: a.name });
      rest = rest.slice(0, hit.index) + " ".repeat(hit[0].length) + rest.slice(hit.index + hit[0].length);
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Typing "@" to pick somebody, rather than typing their name exactly right.
 *
 * The chips under the field only ever appended to the END, so naming somebody
 * mid-sentence meant typing their name letter-perfect, diacritics and all, and
 * a caption that missed by one tone mark simply did not reach them.
 * ────────────────────────────────────────────────────────────────────────── */

/** How far back from the caret an "@" may sit and still be the one being typed. */
const MAX_QUERY = 48;

/** A name is at most three words, so a fourth space means the sentence moved on. */
const MAX_QUERY_SPACES = 2;

export type MentionQuery = {
  /** Index of the "@" itself. */
  start: number;
  /** What has been typed after it — may be empty, and may contain spaces. */
  query: string;
};

/**
 * The "@…" the caret is currently inside, if it is inside one.
 *
 * Scans BACK from the caret rather than forward from each "@": the only "@"
 * that matters is the one being typed right now, and looking backwards is also
 * what stops a second mention earlier in the sentence from re-opening the list.
 *
 * The "@" must start the text or follow a non-alphanumeric, which is what keeps
 * an email address out of it — nobody typing "mai@gmail.com" is naming Mai.
 * Vietnamese needs \p{L}, not \w: "ệ" is a non-word character to \w, so an "@"
 * right after it would read as the start of a fresh mention.
 *
 * Spaces are allowed inside the query because Vietnamese names have them
 * ("Thủy Mai"), but only two — past that the writer has plainly carried on with
 * the sentence and the list should get out of the way.
 */
export function mentionQueryAt(text: string, caret: number): MentionQuery | null {
  if (caret < 1 || caret > text.length) return null;
  const floor = Math.max(0, caret - MAX_QUERY);
  let spaces = 0;
  for (let i = caret - 1; i >= floor; i--) {
    const ch = text[i];
    if (ch === "\n") return null;
    if (ch === "@") {
      const before = i > 0 ? text[i - 1] : "";
      if (before && /[\p{L}\p{N}]/u.test(before)) return null;
      return { start: i, query: text.slice(i + 1, caret) };
    }
    if (ch === " ") {
      if (++spaces > MAX_QUERY_SPACES) return null;
      continue;
    }
    // Anything that cannot appear inside a name ends the search. Letters,
    // digits and combining marks can; punctuation cannot.
    if (!/[\p{L}\p{N}\p{M}]/u.test(ch)) return null;
  }
  return null;
}

/**
 * Who the query could mean, best first.
 *
 * Matched on folded text — `foldForSearch` drops the tone marks — because the
 * whole point is to reach "Thủy" by typing "thuy". Somebody who can already
 * type the name perfectly never needed this list.
 *
 * A name that STARTS with the query outranks one that merely contains it, so
 * typing "mai" offers "Mai" before "Thủy Mai". Both are offered: a person often
 * reaches for the word they remember, which is not always the first one.
 */
export function filterMentionCandidates(
  members: MentionMember[],
  query: string,
  limit = 6,
): MentionMember[] {
  const q = foldForSearch(query);
  const scored: Array<{ m: MentionMember; rank: number }> = [];
  for (const m of members) {
    if (!m.id || !m.name?.trim()) continue;
    if (!q) {
      scored.push({ m, rank: 0 });
      continue;
    }
    let rank = -1;
    for (const raw of [m.name, m.accountName]) {
      const folded = foldForSearch(raw ?? "");
      if (!folded) continue;
      if (folded.startsWith(q)) rank = Math.max(rank, 2);
      // Word-start, so "mai" finds "Thủy Mai" but "ai" does not.
      else if (folded.split(" ").some((w) => w.startsWith(q))) rank = Math.max(rank, 1);
    }
    if (rank >= 0) scored.push({ m, rank });
  }
  scored.sort((a, b) => b.rank - a.rank || a.m.name.localeCompare(b.m.name, "vi"));
  return scored.slice(0, limit).map((s) => s.m);
}

/**
 * The text with the half-typed query replaced by the whole name.
 *
 * Returns the caret too: it belongs after the trailing space, so the writer
 * carries straight on with the sentence instead of hunting for where they were.
 */
export function applyMention(
  text: string,
  q: MentionQuery,
  name: string,
  caret: number,
): { text: string; caret: number } {
  /*
   * Only add the separating space when there is not already one there.
   * `appendMention` learned this the hard way — a chip tapped after a sentence
   * that already ended in a space left two, and the pair was saved into the
   * caption. Inserting mid-sentence hits it far more often, because the space
   * before the next word is always sitting right there.
   */
  const rest = text.slice(caret);
  const token = `${mentionToken(name)}${/^\s/.test(rest) ? "" : " "}`;
  const next = text.slice(0, q.start) + token + rest;
  return { text: next, caret: q.start + token.length };
}

/** Ids of the members named anywhere in the text. */
export function collectMentions(text: string, members: MentionMember[]): string[] {
  return [...new Set(findMentionRanges(text, members).map((r) => r.id))];
}
