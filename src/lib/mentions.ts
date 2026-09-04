/*
 * Naming someone in a caption.
 *
 * Derived from the text at save time rather than tracked as its own state. The
 * alternative — a list of ids maintained beside the words — drifts the moment
 * someone edits the sentence: delete the name and the mention survives, so the
 * other person is notified about a caption that no longer names them. Reading
 * the text is the only version that cannot disagree with what is on screen.
 */

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

/** Ids of the members named anywhere in the text. */
export function collectMentions(text: string, members: MentionMember[]): string[] {
  return [...new Set(findMentionRanges(text, members).map((r) => r.id))];
}
