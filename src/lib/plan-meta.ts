// Display metadata for the calendar/itinerary engine: time-of-day buckets, the
// default tag palette, and the merge helper that keeps built-in tags present
// even after a couple adds their own. Shared by client UI and server routers.

export const BUCKETS = [
  { key: "morning", label: "Sáng", icon: "🌅" },
  { key: "noon", label: "Trưa", icon: "☀️" },
  { key: "afternoon", label: "Chiều", icon: "🌤️" },
  { key: "evening", label: "Tối", icon: "🌙" },
] as const;

export type BucketKey = (typeof BUCKETS)[number]["key"];
export const BUCKET_KEYS = BUCKETS.map((b) => b.key) as BucketKey[];
export const BUCKET_ORDER: Record<BucketKey, number> = {
  morning: 0,
  noon: 1,
  afternoon: 2,
  evening: 3,
};

export const PLAN_STATUSES = ["planned", "done", "skipped"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export type Tag = { name: string; color: string; icon?: string };

// Built-in palette — colours pulled from the existing terracotta/pastel theme so
// dots on the calendar read as part of the same system.
export const DEFAULT_TAGS: Tag[] = [
  { name: "Hẹn hò", color: "#e8a598", icon: "🌹" },
  { name: "Ăn uống", color: "#d4a373", icon: "🍜" },
  { name: "Du lịch", color: "#a3b18a", icon: "✈️" },
  { name: "Quà", color: "#cb997e", icon: "🎁" },
  { name: "Việc cần làm", color: "#6f675d", icon: "✅" },
  { name: "Kỷ niệm", color: "#c2693f", icon: "💞" },
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
