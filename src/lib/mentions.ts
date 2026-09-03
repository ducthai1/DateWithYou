/*
 * Naming someone in a caption.
 *
 * Derived from the text at save time rather than tracked as its own state. The
 * alternative — a list of ids maintained beside the words — drifts the moment
 * someone edits the sentence: delete the name and the mention survives, so the
 * other person is notified about a caption that no longer names them. Reading
 * the text is the only version that cannot disagree with what is on screen.
 */

export type MentionMember = { id: string; name: string };

/** What gets inserted into the text when someone taps a name. */
export function mentionToken(name: string): string {
  return `@${name.trim()}`;
}

/** Escapes a name so a regex built from it matches it literally. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Ids of the members named anywhere in the text.
 *
 * Longest name first, so a person called "An" cannot claim the mention meant
 * for "An Nhiên". Case-insensitive because nobody capitalises consistently on
 * a phone, and a mention is worth finding either way.
 *
 * The character after the name must not be a letter or digit, which is what
 * keeps "@An" out of "@Anh" — Vietnamese needs the Unicode property escape
 * here, since \w would treat "ệ" as a non-word character and match halfway
 * through a name.
 */
export function collectMentions(text: string, members: MentionMember[]): string[] {
  if (!text) return [];
  const found = new Set<string>();
  const ordered = [...members]
    .filter((m) => m.id && m.name?.trim())
    .sort((a, b) => b.name.trim().length - a.name.trim().length);

  /*
   * Matches are CONSUMED, not just tested.
   *
   * Sorting longest-first is not enough on its own: the character after "An" in
   * "@An Nhiên" is a space, which passes the boundary check, so "An" matched
   * inside "An Nhiên" and both people were notified. Blanking each match before
   * looking for the next name is what stops a shorter name being found inside a
   * longer one that already claimed it.
   */
  let rest = text;
  for (const m of ordered) {
    const re = new RegExp(`@${escapeRe(m.name.trim())}(?![\\p{L}\\p{N}])`, "giu");
    if (re.test(rest)) {
      found.add(m.id);
      // Same length of filler, so later offsets and boundaries stay honest.
      rest = rest.replace(re, (hit) => " ".repeat(hit.length));
    }
  }
  return [...found];
}
