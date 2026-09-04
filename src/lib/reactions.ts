/**
 * Every emoji a reaction may be, and what to call each one.
 *
 * Lives here rather than in the Mongoose model so the picker can read it
 * without pulling the database layer into the browser — the model imports this
 * list, which makes it the one authority instead of two arrays kept in step by
 * a `satisfies` and a comment asking future readers to be careful.
 */
export const REACTION_EMOJIS = [
  // The six the bar opens with. Order matters: this is the default row.
  "❤️", "😍", "🥹", "😂", "🔥", "👏",
  // Everything the "+" offers. Free to grow; a saved reaction outside the list
  // would be rejected on the way in, never on the way out.
  "🥰", "😘", "🤗", "😭", "🤣", "😎",
  "🤩", "😜", "🙈", "😴", "🤤", "🥳",
  "💐", "🍀", "✨", "💯", "🙏", "🫶",
] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** How many sit on the bar before the "+". */
export const REACTION_BAR_SIZE = 6;

/** What the bar shows until someone rearranges it. */
export const DEFAULT_REACTION_BAR: ReactionEmoji[] = REACTION_EMOJIS.slice(
  0,
  REACTION_BAR_SIZE,
) as ReactionEmoji[];

/** Vietnamese label per emoji — screen readers get words, not codepoints. */
export const REACTION_LABEL: Record<ReactionEmoji, string> = {
  "❤️": "Thương", "😍": "Mê quá", "🥹": "Xúc động", "😂": "Cười", "🔥": "Cháy", "👏": "Vỗ tay",
  "🥰": "Yêu ghê", "😘": "Hôn cái", "🤗": "Ôm cái", "😭": "Khóc", "🤣": "Cười lăn", "😎": "Ngầu",
  "🤩": "Mê tít", "😜": "Lầy", "🙈": "Mắc cỡ", "😴": "Buồn ngủ", "🤤": "Thèm", "🥳": "Quẩy",
  "💐": "Tặng hoa", "🍀": "May mắn", "✨": "Lung linh", "💯": "Chuẩn", "🙏": "Cảm ơn", "🫶": "Thương thương",
};

/** Keeps a personal bar valid: known emojis, no repeats, exactly the bar size. */
export function normaliseReactionBar(raw: unknown): ReactionEmoji[] {
  const known = new Set<string>(REACTION_EMOJIS);
  const seen = new Set<string>();
  const out: ReactionEmoji[] = [];
  for (const e of Array.isArray(raw) ? raw : []) {
    if (typeof e === "string" && known.has(e) && !seen.has(e)) {
      seen.add(e);
      out.push(e as ReactionEmoji);
    }
  }
  // Top up from the defaults so the bar is never short — a half-empty row of
  // reactions reads as broken, not as a preference.
  for (const e of DEFAULT_REACTION_BAR) {
    if (out.length >= REACTION_BAR_SIZE) break;
    if (!seen.has(e)) { seen.add(e); out.push(e); }
  }
  return out.slice(0, REACTION_BAR_SIZE);
}
