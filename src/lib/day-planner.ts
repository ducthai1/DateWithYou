/**
 * Building a day out of places, when nobody wants to plan one.
 *
 * The product is called "Vivu No Plan" and this is the part that earns the
 * name: given the places a couple has saved, produce an actual afternoon —
 * times, stops, distances, a money range — that a person could follow.
 *
 * **The skeleton comes before the places, and that is the whole design.**
 * Matching places to each other first is what produces three cafés in a row,
 * or dinner at 15:00. Starting from a shape of the day — a coffee, then
 * dinner, then a walk — means every answer is sensible to a human being before
 * any scoring happens. The algorithm then only has to fill slots.
 *
 * Kept pure on purpose: no React, no network, no Mongoose. Everything it needs
 * is an argument, including *when each place was last visited*, which the
 * caller reads from the last month of plan items. That is what makes the
 * interesting behaviour testable in plain `node --test` — see
 * tests/unit/day-planner.test.ts.
 */
import { isOpenAt } from "@/lib/maps";
import { haversineM } from "@/lib/route-geometry";
import { bucketForTime, type BucketKey } from "@/lib/plan-meta";
import {
  BUDGET_MAX_LEVEL,
  costBandFor,
  kindOfCategory,
  type BudgetKey,
  type SlotKind,
} from "@/lib/day-planner-taxonomy";

export {
  SLOT_KINDS,
  kindOfCategory,
  costBandFor,
  BUDGET_KEYS,
  BUDGET_LABELS,
} from "@/lib/day-planner-taxonomy";
export type { SlotKind, BudgetKey } from "@/lib/day-planner-taxonomy";

export type LatLng = { lat: number; lng: number };

export type Slot = {
  kind: SlotKind;
  /** Label bucket, derived from `startTime` so the two can never disagree. */
  bucket: BucketKey;
  /** "HH:mm", local time. */
  startTime: string;
  minutes: number;
};

export type SkeletonName = "afternoon-evening" | "late-evening" | "weekend-long";

export type Skeleton =
  | { ok: true; name: SkeletonName; slots: Slot[] }
  | { ok: false; reason: "outOfHours"; nextStartAt: string };

/*
 * Three shapes of day, chosen by the clock — not offered as a menu.
 *
 * Tapping at 21:00 cannot produce a three-stop evening that ends after
 * midnight, so the template has to follow the hour. Outside these windows the
 * honest answer is "not now", with a time to come back to: forcing a plan at
 * 03:00 would be the generator's first and last impression.
 */
const TEMPLATES: Record<SkeletonName, Array<{ kind: SlotKind; after: number; minutes: number }>> = {
  "afternoon-evening": [
    { kind: "cafe", after: 0, minutes: 75 },
    { kind: "meal", after: 90, minutes: 90 },
    { kind: "stroll", after: 195, minutes: 75 },
  ],
  "late-evening": [
    { kind: "meal", after: 0, minutes: 90 },
    { kind: "drink", after: 105, minutes: 75 },
  ],
  "weekend-long": [
    { kind: "meal", after: 0, minutes: 90 },
    { kind: "cafe", after: 105, minutes: 75 },
    { kind: "entertain", after: 195, minutes: 120 },
    { kind: "meal", after: 345, minutes: 90 },
  ],
};

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const clock = (mins: number) => {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Weekday of a "YYYY-MM-DD", read in UTC so a timezone cannot shift the day. */
function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

/** A local Date for a given day and "HH:mm" — what `isOpenAt` expects. */
function localAt(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, Number(time.slice(0, 2)), Number(time.slice(3, 5)));
}

export function buildSkeleton(when: { date: string; startAt: string }): Skeleton {
  const start = minutesOf(when.startAt);
  if (!Number.isFinite(start)) return { ok: false, reason: "outOfHours", nextStartAt: "14:00" };
  const day = weekdayOf(when.date);
  const isWeekend = day === 0 || day === 6;

  const name: SkeletonName | null =
    isWeekend && start >= 11 * 60 && start < 14 * 60 ? "weekend-long"
    : start >= 14 * 60 && start < 18 * 60 + 30 ? "afternoon-evening"
    : start >= 18 * 60 + 30 && start <= 22 * 60 ? "late-evening"
    : null;

  if (!name) {
    // Point at the next window that would work rather than stopping dead: a
    // refusal with no way forward is where a first-time visitor leaves.
    const next = isWeekend && start < 11 * 60 ? "11:00" : "14:00";
    return { ok: false, reason: "outOfHours", nextStartAt: next };
  }

  return {
    ok: true,
    name,
    slots: TEMPLATES[name].map((t) => {
      const startTime = clock(start + t.after);
      return { kind: t.kind, bucket: bucketForTime(startTime), startTime, minutes: t.minutes };
    }),
  };
}

/** A place the planner may use. Shaped by the caller, never fetched here. */
export type Candidate = {
  id: string;
  name: string;
  /** The space's own category name — see `kindOfCategory`. */
  category: string;
  district: string;
  geo?: LatLng | null;
  rating?: number | null;
  /** Google's 0–4 scale, when known. */
  priceLevel?: number | null;
  status: "want_to_go" | "visited";
  mustTry?: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  source?: "user" | "suggested";
  /** Epoch ms of the last visit, read from recent plan items by the caller. */
  lastVisitedAt?: number | null;
};

export type PlanRequest = {
  /** "YYYY-MM-DD". */
  date: string;
  /** "HH:mm". */
  startAt: string;
  /** District names; empty means anywhere. */
  areas?: string[];
  /** Restrict to these kinds; ignored when it would empty the day. */
  kinds?: SlotKind[];
  budget?: BudgetKey;
  origin?: LatLng | null;
  vibe?: string | null;
  /** Same seed, same day. Changing it is what "give me another" does. */
  seed?: string;
  /** Epoch ms used for the recency penalty; defaults to midday on `date`. */
  now?: number;
};

export type PlannedStop = {
  slot: Slot;
  place: Candidate | null;
  unfilled: boolean;
  /** Why this place, in one sentence. Phase 6 may rewrite it; it never invents. */
  reason: string;
  /** Straight-line metres from the previous filled stop, or from `origin`. */
  travelM: number | null;
  cost: { min: number; max: number };
  warnings: string[];
};

export type DayPlanDraft = {
  ok: true;
  skeleton: SkeletonName;
  date: string;
  startAt: string;
  stops: PlannedStop[];
  band: { min: number; max: number };
  unfilledKinds: SlotKind[];
  warnings: string[];
  seed: string;
};

export type DayPlanRefusal = { ok: false; reason: "outOfHours"; nextStartAt: string };

/* ——— scoring ——————————————————————————————————————————————————————— */

/** Points for a place still on the wish list rather than already ticked off. */
const W_WANT = 30;
/** Per star. An unrated place is treated as a 3, not as a zero. */
const W_RATING = 6;
const W_MUSTTRY = 8;
/** Full marks for next door, nothing beyond WALKABLE_M. */
const W_NEAR = 20;
const WALKABLE_M = 5_000;
/** The most a just-visited place can lose. Deliberately bigger than a star. */
const W_RECENT = 40;
const RECENT_DAYS = 30;
/** A place whose category we could not read: usable, but last in line. */
const W_UNKNOWN_KIND = -15;
/** Tie-break only. With everything else equal this is what the seed moves. */
const W_JITTER = 2;

/** Deterministic 0–1 from a string (FNV-1a, then scrambled). */
function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491);
  h ^= h >>> 13;
  return ((h >>> 0) % 100_000) / 100_000;
}

function recencyPenalty(lastVisitedAt: number | null | undefined, now: number): number {
  if (!lastVisitedAt) return 0;
  const days = (now - lastVisitedAt) / 86_400_000;
  if (days >= RECENT_DAYS || days < 0) return 0;
  return W_RECENT * (1 - days / RECENT_DAYS);
}

function scoreOf(
  c: Candidate,
  slot: Slot,
  from: LatLng | null,
  seed: string,
  now: number,
): number {
  const kind = kindOfCategory(c.category);
  let score = 0;
  score += c.status === "want_to_go" ? W_WANT : 0;
  score += (typeof c.rating === "number" ? c.rating : 3) * W_RATING;
  score += c.mustTry ? W_MUSTTRY : 0;
  score += kind === null ? W_UNKNOWN_KIND : 0;
  score -= recencyPenalty(c.lastVisitedAt, now);
  if (from && c.geo) {
    const d = haversineM(from, c.geo);
    score += W_NEAR * Math.max(0, 1 - d / WALKABLE_M);
  }
  score += hash01(`${seed}|${slot.kind}|${c.id}`) * W_JITTER;
  return score;
}

/** One sentence per stop, built only from facts already on the record. */
function reasonFor(c: Candidate, slot: Slot, now: number): string {
  if (c.mustTry) return `Bạn đã ghi "${c.mustTry}" ở đây.`;
  if (c.status === "want_to_go" && !c.lastVisitedAt) return "Chỗ hai người lưu mà chưa ghé lần nào.";
  if (recencyPenalty(c.lastVisitedAt, now) === 0 && c.lastVisitedAt) return "Lâu rồi chưa quay lại.";
  if (typeof c.rating === "number" && c.rating >= 4) return `Bạn chấm ${c.rating} sao cho chỗ này.`;
  return `Hợp với khung ${slot.startTime}.`;
}

/**
 * Fill each slot in order, letting the previous choice pull the next one.
 *
 * Greedy rather than a global optimum on purpose: the day is three or four
 * stops, the time order is fixed by the skeleton, and the only thing left to
 * decide is which place per slot. Distance to the stop before is part of the
 * score, so the route stops zig-zagging without a separate routing pass — and
 * the result stays explainable, which matters because every stop has to show a
 * reason to the person reading it.
 */
export function planDay(req: PlanRequest, pool: Candidate[]): DayPlanDraft | DayPlanRefusal {
  const skeleton = buildSkeleton({ date: req.date, startAt: req.startAt });
  if (!skeleton.ok) return skeleton;

  const seed = req.seed ?? "";
  const now = req.now ?? localAt(req.date, "12:00").getTime();
  const areas = req.areas?.filter(Boolean) ?? [];
  const maxLevel = BUDGET_MAX_LEVEL[req.budget ?? "tuy-y"];

  // Asking for only one kind narrows the day; asking for a kind this template
  // has none of would empty it, and an empty screen is worse than a day that
  // includes one stop you did not ask for.
  const wanted = req.kinds?.filter(Boolean) ?? [];
  const narrowed = wanted.length ? skeleton.slots.filter((s) => wanted.includes(s.kind)) : [];
  const slots = narrowed.length ? narrowed : skeleton.slots;

  const used = new Set<string>();
  const stops: PlannedStop[] = [];
  let from: LatLng | null = req.origin ?? null;
  let isFirstHop = true;

  for (const slot of slots) {
    const eligible = pool.filter((c) => {
      if (used.has(c.id)) return false;
      if (areas.length && !areas.includes(c.district)) return false;
      const kind = kindOfCategory(c.category);
      // An unreadable category is allowed anywhere rather than nowhere: these
      // lists are user-editable, and "Khác" is the app's own catch-all.
      if (kind !== null && kind !== slot.kind) return false;
      if (typeof c.priceLevel === "number" && c.priceLevel > maxLevel) return false;
      return isOpenAt(c, localAt(req.date, slot.startTime));
    });

    let best: Candidate | null = null;
    let bestScore = -Infinity;
    for (const c of eligible) {
      const s = scoreOf(c, slot, from, seed, now);
      if (s > bestScore) { best = c; bestScore = s; }
    }

    if (!best) {
      stops.push({
        slot, place: null, unfilled: true, reason: "",
        travelM: null, cost: { min: 0, max: 0 }, warnings: [],
      });
      continue;
    }

    used.add(best.id);
    const warnings: string[] = [];
    if (!best.openTime || !best.closeTime) {
      // Most rows have no hours at all. Saying so is the difference between a
      // suggestion and a promise we cannot keep.
      warnings.push("Chưa rõ giờ mở cửa — gọi trước cho chắc nhé.");
    }
    if (kindOfCategory(best.category) === null) {
      warnings.push("Chỗ này không rõ thuộc loại nào, mình xếp tạm vào đây.");
    }

    const travelM = from && best.geo && !(isFirstHop && !req.origin)
      ? Math.round(haversineM(from, best.geo))
      : null;
    stops.push({
      slot,
      place: best,
      unfilled: false,
      reason: reasonFor(best, slot, now),
      travelM,
      cost: costBandFor(slot.kind, best.priceLevel),
      warnings,
    });
    if (best.geo) from = best.geo;
    isFirstHop = false;
  }

  const band = stops.reduce(
    (a, s) => ({ min: a.min + s.cost.min, max: a.max + s.cost.max }),
    { min: 0, max: 0 },
  );
  const unfilledKinds = stops.filter((s) => s.unfilled).map((s) => s.slot.kind);
  const warnings: string[] = [];
  if (unfilledKinds.length === stops.length) {
    warnings.push("Chưa đủ chỗ đã lưu để lên kế hoạch — thêm vài nơi bạn thích nhé.");
  }

  return {
    ok: true,
    skeleton: skeleton.name,
    date: req.date,
    startAt: req.startAt,
    stops,
    band,
    unfilledKinds,
    warnings,
    seed,
  };
}
