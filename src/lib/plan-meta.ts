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

/** Resolve tag names → colours for calendar dots, using the merged palette. */
export function colorsForTags(tagNames: string[], palette: Tag[]): string[] {
  const byName = new Map(palette.map((t) => [t.name.toLowerCase(), t.color]));
  return tagNames
    .map((n) => byName.get(n.toLowerCase()))
    .filter((c): c is string => Boolean(c));
}
