/**
 * The vocabulary the day planner thinks in, kept apart from the planning.
 *
 * Two things live here and nothing else: what kind of stop a slot is, and what
 * a stop of that kind tends to cost. Both are judgement calls about the real
 * world rather than algorithm, both need changing as the app learns more, and
 * both are the parts a reader will want to argue with — so they are in one
 * short file instead of buried inside the scoring.
 *
 * Pure by design: no React, no network, no Mongoose. See day-planner.ts.
 */
import { foldForSearch } from "@/lib/vietnamese-text";

/** The kinds of stop a day is built from. */
export const SLOT_KINDS = ["meal", "cafe", "drink", "stroll", "entertain"] as const;
export type SlotKind = (typeof SLOT_KINDS)[number];

/*
 * Category names belong to each space, not to us.
 *
 * `location.getConfig` returns a list the couple can rename and extend, so the
 * planner cannot switch on a fixed enum — it has to read whatever they wrote.
 * These are the words that map a written name onto a kind; anything unmatched
 * stays null rather than being guessed into the nearest bucket, because filing
 * a second-hand bookshop under "dinner" is worse than admitting we do not know.
 *
 * Order matters: the first kind with a hit wins, so the more specific lists
 * (drink, entertain) come before the broad ones.
 */
const KIND_WORDS: Record<SlotKind, string[]> = {
  drink: ["bar", "pub", "bia", "beer", "cocktail", "rooftop", "lounge", "nhau", "quan nhau", "do uong"],
  entertain: [
    "rap", "rap phim", "phim", "cinema", "karaoke", "bowling", "game", "workshop",
    "bao tang", "trien lam", "concert", "live", "nha sach", "vui choi", "giai tri",
  ],
  meal: [
    "an", "an sang", "an trua", "an toi", "com", "lau", "nuong", "buffet", "hai san",
    "street food", "quan an", "nha hang", "bun", "pho", "banh mi", "mi", "chay", "an vat",
  ],
  cafe: ["ca phe", "cafe", "coffee", "tra", "tra sua", "bakery", "banh ngot", "kem", "che", "dessert", "tiem banh"],
  stroll: [
    "cong vien", "di dao", "dao", "bo song", "pho di bo", "chup anh", "song",
    "bien", "ho", "cau", "vuon", "checkin", "check in", "song nuoc",
  ],
};

/**
 * Which kind a space's own category name means, or null when unrecognised.
 *
 * Matched on whole words after folding the diacritics away, so "an" finds
 * "Ăn tối" but not "Bản đồ cổ". Substring matching is the obvious
 * implementation here and it is wrong for exactly that reason — Vietnamese is
 * full of short syllables that sit inside longer ones.
 */
export function kindOfCategory(category: string): SlotKind | null {
  const tokens = foldForSearch(category).split(" ").filter(Boolean);
  if (!tokens.length) return null;
  const joined = ` ${tokens.join(" ")} `;
  for (const kind of SLOT_KINDS) {
    for (const word of KIND_WORDS[kind]) {
      if (joined.includes(` ${word} `)) return kind;
    }
  }
  return null;
}

/**
 * What one stop costs per person, in đồng, as a range.
 *
 * Google's `price_level` is 0–4 and is all the price signal that exists — no
 * menu is ever scraped, and nothing here pretends to know the bill. These
 * numbers are everyday Ho Chi Minh City ranges, wide on purpose: a band that
 * is too tight reads as a promise, and the app cannot keep it.
 *
 * A place with no price level gets the kind's typical level rather than being
 * dropped, because almost every hand-added row has no price level at all.
 */
const COST: Record<SlotKind, Array<[min: number, max: number]>> = {
  //            level 0            1                  2                   3                    4
  meal:      [[40_000, 80_000], [80_000, 160_000], [160_000, 320_000], [320_000, 650_000], [650_000, 1_200_000]],
  cafe:      [[25_000, 45_000], [45_000, 85_000],  [85_000, 150_000],  [150_000, 260_000], [260_000, 450_000]],
  drink:     [[40_000, 80_000], [80_000, 160_000], [160_000, 300_000], [300_000, 550_000], [550_000, 900_000]],
  entertain: [[0, 60_000],      [60_000, 140_000], [140_000, 280_000], [280_000, 500_000], [500_000, 900_000]],
  stroll:    [[0, 30_000],      [0, 50_000],       [0, 80_000],        [0, 120_000],       [0, 200_000]],
};

/** The level assumed when a place never said. */
export const DEFAULT_PRICE_LEVEL: Record<SlotKind, number> = {
  meal: 1, cafe: 1, drink: 1, entertain: 1, stroll: 0,
};

export function costBandFor(kind: SlotKind, priceLevel: number | null | undefined) {
  const level = typeof priceLevel === "number" && priceLevel >= 0 && priceLevel <= 4
    ? Math.round(priceLevel)
    : DEFAULT_PRICE_LEVEL[kind];
  const [min, max] = COST[kind][level];
  return { min, max };
}

/*
 * What the person meant by "rẻ thôi".
 *
 * A budget is a ceiling on price level, not a total: the total is whatever the
 * chosen stops add up to, and it is reported as a band. Places with no price
 * level are never excluded by a budget — see above, that is most of them.
 */
export const BUDGET_KEYS = ["tiet-kiem", "vua", "thoai-mai", "tuy-y"] as const;
export type BudgetKey = (typeof BUDGET_KEYS)[number];

export const BUDGET_MAX_LEVEL: Record<BudgetKey, number> = {
  "tiet-kiem": 1,
  vua: 2,
  "thoai-mai": 4,
  "tuy-y": 4,
};

export const BUDGET_LABELS: Record<BudgetKey, string> = {
  "tiet-kiem": "Tiết kiệm",
  vua: "Vừa phải",
  "thoai-mai": "Thoải mái",
  "tuy-y": "Tuỳ hệ thống",
};
