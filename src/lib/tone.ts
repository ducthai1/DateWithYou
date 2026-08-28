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
const ONLY_AFTERNOON = ["afternoon"] as const;
const ONLY_MORNING = ["morning"] as const;

const DIR: Record<Tone, string> = {
  morning: "/brand-image/morning-tone",
  afternoon: "/brand-image/afternoon-tone",
};

export const ART = {
  heroDesk: { file: "hero-desk.png", tones: BOTH },
  appShowcase: { file: "app-showcase.png", tones: BOTH },
  mapIsland: { file: "map-island.png", tones: BOTH },
  memoriesScrapbook: { file: "memories-scrapbook.png", tones: BOTH },
  wheelFood: { file: "wheel-food.png", tones: BOTH },

  calendarTablet: { file: "calendar-tablet.png", tones: ONLY_MORNING },

  mapTreasure: { file: "map-treasure.png", tones: ONLY_AFTERNOON },
  tripPlanner: { file: "trip-planner.png", tones: ONLY_AFTERNOON },
  vaultSafe: { file: "vault-safe.png", tones: ONLY_AFTERNOON },
  emptyBackpack: { file: "empty-backpack.png", tones: ONLY_AFTERNOON },
  emptyCompass: { file: "empty-compass.png", tones: ONLY_AFTERNOON },
  emptyCanvas: { file: "empty-canvas.png", tones: ONLY_AFTERNOON },
  emptyMap: { file: "empty-map.png", tones: ONLY_AFTERNOON },
  bannerWide: { file: "banner-wide.png", tones: ONLY_AFTERNOON },
  bannerOurPage: { file: "banner-our-page.png", tones: ONLY_AFTERNOON },
  bannerSub: { file: "banner-sub.png", tones: ONLY_AFTERNOON },
} satisfies Record<string, ArtEntry>;

export type ArtName = keyof typeof ART;

/** Path to a piece of artwork in the closest tone that actually exists. */
export function artSrc(name: ArtName, tone: Tone): string {
  const entry = ART[name] as ArtEntry;
  const use = entry.tones.includes(tone)
    ? tone
    : (entry.tones[0] as Tone);
  return `${DIR[use]}/${entry.file}`;
}

/** True when this piece only exists in the other tone. */
export function artIsFallback(name: ArtName, tone: Tone): boolean {
  return !(ART[name] as ArtEntry).tones.includes(tone);
}

/* ── The logo, which exists in both tones for every variant ─────────────── */

export type LogoVariant = "wordmark" | "icon" | "icon2048";

const LOGO_FILE: Record<LogoVariant, string> = {
  wordmark: "wordmark",
  icon: "icon",
  icon2048: "icon",
};

export function logoSrc(variant: LogoVariant, tone: Tone): string {
  const suffix = variant === "icon2048" ? "-2048" : "";
  return `/brand-image/logo-icon/${LOGO_FILE[variant]}-${tone}${suffix}.png`;
}
