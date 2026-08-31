/**
 * Morning / afternoon tone.
 *
 * The artwork comes in two palettes — a bright cyan "morning" set and a warm
 * amber "afternoon" set — and the app picks between them. Either the person
 * chooses, or the clock does: before noon is morning, after is afternoon.
 *
 * This is NOT the colour preset in theme-presets.ts. That one is the couple's
 * accent (terracotta, and friends) and lives on the space. Tone only swaps
 * imagery, so it is a per-device choice and stays in a cookie.
 */

import CUTOUTS from "./brand-cutouts.json";

export type Tone = "morning" | "afternoon";

/** What the person picked. "auto" means "follow the clock". */
export type TonePreference = Tone | "auto";

export const TONE_COOKIE_NAME = "vivu_tone";

/** Hour the day tips from morning artwork to afternoon artwork. */
export const AFTERNOON_FROM_HOUR = 12;

/**
 * Rendered before the clock is known — a first visit with no cookie.
 *
 * Afternoon, because it is the warm palette the rest of the brand already
 * uses, so an unavoidable one-frame correction is the smaller change.
 */
export const TONE_FALLBACK: Tone = "afternoon";

export function isTone(v: unknown): v is Tone {
  return v === "morning" || v === "afternoon";
}

export function resolvePreference(raw: string | undefined | null): TonePreference {
  return raw === "morning" || raw === "afternoon" || raw === "auto" ? raw : "auto";
}

/** Which tone a given local hour calls for. */
export function toneForHour(hour: number): Tone {
  return hour < AFTERNOON_FROM_HOUR ? "morning" : "afternoon";
}

/** Milliseconds until the tone would next change on its own. */
export function msUntilNextToneChange(now: Date): number {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(now.getHours() < AFTERNOON_FROM_HOUR ? AFTERNOON_FROM_HOUR : 24);
  return Math.max(1000, next.getTime() - now.getTime());
}

/* ── Which artwork exists, and in which tones ──────────────────────────────
 *
 * Listed rather than guessed at call time: asking for a file that was never
 * generated would 404 silently in production, and the gaps are real — the
 * afternoon set has seventeen pieces and the morning set six.
 *
 * `tones` is the source of truth for what exists. Anything asking for a tone
 * that is missing falls back to the one that is there, so a missing piece is
 * a duller screen rather than a broken image.
 *
 * Two files on disk are deliberately absent from this list:
 * afternoon-tone/wheel-food-alt.png and -alt2.png are near-duplicates of
 * wheel-food.png, kept as spares. Add an entry here if one is ever chosen.
 */
type ArtEntry = { file: string; tones: readonly Tone[] };

const BOTH = ["morning", "afternoon"] as const;
// const ONLY_AFTERNOON = ["afternoon"] as const;  // unused: every role now exists in both tones
const ONLY_MORNING = ["morning"] as const;

const DIR: Record<Tone, string> = {
  morning: "/brand-image/morning-tone",
  afternoon: "/brand-image/afternoon-tone",
};

export const ART = {
  /* ── In both tones ────────────────────────────────────────────────────── */
  heroDesk: { file: "hero-desk.png", tones: BOTH },
  appShowcase: { file: "app-showcase.png", tones: BOTH },
  mapIsland: { file: "map-island.png", tones: BOTH },
  memoriesScrapbook: { file: "memories-scrapbook.png", tones: BOTH },
  wheelFood: { file: "wheel-food.png", tones: BOTH },
  // Ten roles that used to be afternoon-only. The morning set was drawn to
  // match them, so the tone switch finally changes every picture on screen
  // instead of leaving two thirds of them on the warm palette all morning.
  mapTreasure: { file: "map-treasure.png", tones: BOTH },
  tripPlanner: { file: "trip-planner.png", tones: BOTH },
  vaultSafe: { file: "vault-safe.png", tones: BOTH },
  emptyBackpack: { file: "empty-backpack.png", tones: BOTH },
  emptyCompass: { file: "empty-compass.png", tones: BOTH },
  emptyCanvas: { file: "empty-canvas.png", tones: BOTH },
  emptyMap: { file: "empty-map.png", tones: BOTH },
  bannerWide: { file: "banner-wide.png", tones: BOTH },
  bannerOurPage: { file: "banner-our-page.png", tones: BOTH },
  bannerSub: { file: "banner-sub.png", tones: BOTH },

  /* ── One tone only, and honest about it ───────────────────────────────── */
  calendarTablet: { file: "calendar-tablet.png", tones: ONLY_MORNING },

  /* ── Morning-only additions with no afternoon counterpart yet ─────────── */
  heroDeskWide: { file: "hero-desk-wide.png", tones: ONLY_MORNING },
  skyWordmark: { file: "sky-wordmark.png", tones: ONLY_MORNING },
  giftReveal: { file: "gift-reveal.png", tones: ONLY_MORNING },
  wheelFoodAlt: { file: "wheel-food-alt.png", tones: BOTH },
} satisfies Record<string, ArtEntry>;

/* ── Spot illustrations: one object, no scene, and tone-neutral ──────────
 *
 * These live in their own folder because they are a different KIND of picture,
 * not a different palette. The tone sets are wide scenes that fill a band; a
 * spot is a single object, for a place where a scene would crop to a smear —
 * a chip, a small empty state, a card corner.
 *
 * They carry no tone because nothing about a mailbox is warm or cool: they
 * read on either palette, which is why they suit components both tones share.
 *
 * MEASURED, and not what it looks like: every one of these files is OPAQUE
 * with a near-white ground — 0% of their pixels carry any alpha. So they must
 * sit on a white or near-white surface and use `object-contain`; dropped onto
 * a tinted card they draw a white box around themselves. Only the logo files
 * have real alpha. Re-exported with transparency, this constraint goes away
 * and the placements can move onto any surface.
 */
export const SPOT = {
  mailboxOpen: "mailbox-open.png",
  mailboxOpen2: "mailbox-open-2.png",
  starRibbon: "star-ribbon.png",
  pinTicket: "pin-ticket.png",
  planeTrail: "plane-trail.png",
  islandCampsite: "island-campsite.png",
  backpackScrapbook: "backpack-scrapbook.png",
  flatlayCameraMap: "flatlay-camera-map.png",
} as const;

export type SpotName = keyof typeof SPOT;

export function spotSrc(name: SpotName): string {
  return `/brand-image/common-page/${SPOT[name]}`;
}

export type ArtName = keyof typeof ART;

/** Path to a piece of artwork in the closest tone that actually exists. */
export function artSrc(name: ArtName, tone: Tone): string {
  const entry = ART[name] as ArtEntry;
  const use = entry.tones.includes(tone)
    ? tone
    : (entry.tones[0] as Tone);
  return `${DIR[use]}/${entry.file}`;
}

/**
 * Which files were exported with a real alpha channel.
 *
 * Measured, not assumed — the list is the output of scanning every file for
 * pixels with alpha < 250, and it is a property of the FILE, not of the role:
 * map-island is cut out in morning and opaque in afternoon.
 *
 * It matters because a cut-out picture must be drawn bare. Wrapped in the
 * rounded card + border the opaque ones need, it reads as if the background
 * was never removed at all — the frame supplies exactly the box the cut-out
 * was made to escape.
 *
 * Re-export another file with alpha and add it here, or it keeps its frame.
 */
// Measured, not remembered: `scripts/measure-brand-cutouts.mjs` rewrites this
// list from the pixels. A hand-kept list silently went wrong the moment
// background-removed exports replaced the old opaque files under the same
// names — the art was cut out and still drawn inside a white card. Re-run the
// script after touching anything in public/brand-image.
const TRANSPARENT: ReadonlySet<string> = new Set(CUTOUTS);

/** True when this piece is cut out, so it must be drawn without a card. */
export function artIsTransparent(name: ArtName, tone: Tone): boolean {
  const entry = ART[name] as ArtEntry;
  const use = entry.tones.includes(tone) ? tone : (entry.tones[0] as Tone);
  return TRANSPARENT.has(`${use}-tone/${entry.file}`);
}

/** True when a common-page spot is cut out. */
export function spotIsTransparent(name: SpotName): boolean {
  return TRANSPARENT.has(`common-page/${SPOT[name]}`);
}

/** True when this piece only exists in the other tone. */
export function artIsFallback(name: ArtName, tone: Tone): boolean {
  return !(ART[name] as ArtEntry).tones.includes(tone);
}

/* ── The logo, which exists in both tones for every variant ─────────────── */

export type LogoVariant = "wordmark" | "icon";

/**
 * Which logo file to show, given the tone and the hour.
 *
 * The morning set arrived with two wordmarks and the afternoon set with two,
 * so rather than pick one and waste the other, the hour decides: even hours
 * get the first, odd hours the second. It changes at most twice while someone
 * is looking at the app, which reads as the app being alive rather than as a
 * glitch — and every drawing that was paid for gets used.
 *
 * `dual` carries a "Morning or Afternoon" badge, so it is the honest choice
 * anywhere the tone is not yet known — it is never wrong.
 *
 * All files carry real alpha, so they sit on any surface without a white box.
 */
const WORDMARK: Record<Tone, readonly [string, string]> = {
  morning: ["wordmark-morning", "wordmark-dual"],
  afternoon: ["wordmark-afternoon", "wordmark-afternoon-2"],
};

const ICON: Record<Tone, readonly [string, string]> = {
  morning: ["icon-morning", "icon-duotone"],
  afternoon: ["icon-afternoon", "icon-afternoon-2"],
};

/**
 * `hour` is the reader's local hour. Pass it explicitly rather than reading a
 * clock in here: this is called during render, and a function that returns a
 * different answer on the server than on the client is a hydration mismatch.
 */
export function logoSrc(variant: LogoVariant, tone: Tone, hour?: number): string {
  const pair = variant === "wordmark" ? WORDMARK[tone] : ICON[tone];
  const file = hour === undefined ? pair[0] : pair[hour % 2];
  return `/brand-image/logo-icon/${file}.png`;
}

/** The tone-agnostic wordmark, for anywhere the tone has not resolved yet. */
export function logoDualSrc(): string {
  return "/brand-image/logo-icon/wordmark-dual.png";
}