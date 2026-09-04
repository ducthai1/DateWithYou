// Display metadata for the calendar/itinerary engine: time-of-day buckets, the
// default tag palette, and the merge helper that keeps built-in tags present
// even after a couple adds their own. Shared by client UI and server routers.

export const BUCKETS = [
  { key: "morning", label: "Sáng", icon: "sunrise" },
  { key: "noon", label: "Trưa", icon: "sun" },
  { key: "afternoon", label: "Chiều", icon: "cloud-sun" },
  { key: "evening", label: "Tối", icon: "moon" },
] as const;

export type BucketKey = (typeof BUCKETS)[number]["key"];
export const BUCKET_KEYS = BUCKETS.map((b) => b.key) as BucketKey[];
export const BUCKET_ORDER: Record<BucketKey, number> = {
  morning: 0,
  noon: 1,
  afternoon: 2,
  evening: 3,
};

/**
 * Which bucket an "HH:mm" belongs to, so a picked time and the labelled bucket
 * can never disagree (19:00 must not sit under "Sáng"). Boundaries follow the
 * everyday Vietnamese split; evening wraps past midnight, which is why it is
 * the fallback rather than a range.
 */
export function bucketForTime(time: string): BucketKey {
  const h = Number(time.slice(0, 2));
  if (!Number.isFinite(h)) return "morning";
  if (h >= 5 && h < 11) return "morning";   // Sáng  05:00–10:59
  if (h >= 11 && h < 13) return "noon";     // Trưa  11:00–12:59
  if (h >= 13 && h < 18) return "afternoon"; // Chiều 13:00–17:59
  return "evening";                          // Tối   18:00–04:59
}

export const PLAN_STATUSES = ["planned", "done", "skipped"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export type Tag = { name: string; color: string; icon?: string };

// Built-in palette — colours harmonised with the terracotta/warm preset so
// calendar dots read as part of the same design system at any theme.
// Saturation kept mid-range so dots remain legible on the warm bg (#f1ece3).
export const DEFAULT_TAGS: Tag[] = [
  { name: "Hẹn hò",        color: "#d97f72", icon: "heart" },           // warm coral
  { name: "Ăn uống",       color: "#c8955a", icon: "utensils-crossed" }, // amber-tan
  { name: "Du lịch",       color: "#7fa882", icon: "plane" },            // soft sage
  { name: "Quà",           color: "#b07cc6", icon: "gift" },             // gentle plum
  { name: "Việc cần làm",  color: "#7a9db5", icon: "list-checks" },      // muted ocean
  { name: "Kỷ niệm",       color: "#c2693f", icon: "sparkles" },         // terracotta accent
];

/** Default palette + a space's custom tags, defaults first, de-duped by name. */
export function mergeTags(custom: Tag[] | undefined): Tag[] {
  const seen = new Set(DEFAULT_TAGS.map((t) => t.name.toLowerCase()));
  const extra = (custom ?? []).filter((t) => !seen.has(t.name.toLowerCase()));
  return [...DEFAULT_TAGS, ...extra];
}

/**
 * Text colour for a tag's fill.
 *
 * White by choice: on this palette it is what makes a tag read as a tag rather
 * than as a word lying in a puddle. Near-black measures better on paper — 4.49
 * to 6.58 against white's 2.66 to 3.90 — and it was tried; on soft mid-tones it
 * simply sinks, which is a real legibility problem too, just not one a ratio
 * catches.
 *
 * The fallback is not a compromise on that, it is a floor: a genuinely pale
 * fill (a custom pastel yellow, say) leaves white with nothing to sit on at
 * all, and there dark is not a preference but the only thing visible. Computed
 * rather than fixed so a colour added later is handled without anyone
 * remembering this rule exists.
 */
export function readableInk(background: string): string {
  const hex = background.replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const channel = (i: number) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  const onWhite = 1.05 / (L + 0.05);
  // Below this white stops being thin and starts being absent. The six built-in
  // tags all sit above it, so they stay white.
  return onWhite >= 2.5 ? "#ffffff" : "#1c1917";
}

/** Resolve tag names → colours for calendar dots, using the merged palette. */
export function colorsForTags(tagNames: string[], palette: Tag[]): string[] {
  const byName = new Map(palette.map((t) => [t.name.toLowerCase(), t.color]));
  return tagNames
    .map((n) => byName.get(n.toLowerCase()))
    .filter((c): c is string => Boolean(c));
}
