/**
 * Typed registry of accent-colour presets for the couple space.
 *
 * Each preset overrides the accent triplet and gradient stops in CSS via
 * [data-theme="key"] attribute on <html>. The warm background (#f1ece3) is
 * intentionally shared across all presets so surfaces always read correctly.
 *
 * Single source of truth: Settings swatches + SSR layout both import from here
 * so the key list never drifts between the UI picker and the CSS blocks.
 */

export type ThemePresetKey =
  | "terracotta"
  | "rose"
  | "sage"
  | "plum"
  | "ocean"
  | "honey";

export interface ThemePreset {
  key: ThemePresetKey;
  label: string;
  /** Primary action colour */
  accent: string;
  /** Darker shade for hover/active states */
  accentHover: string;
  /** Muted tint for soft backgrounds (badges, chips) */
  accentSoft: string;
  /** Focus-visible ring colour (usually = accent) */
  ring: string;
  /** Gradient mesh start colour */
  gradientFrom: string;
  /** Gradient mesh end colour */
  gradientTo: string;
}

/**
 * All available presets. `terracotta` is the default and its values live in
 * :root so it works without any data-theme attribute (legacy / first visit).
 */
export const THEME_PRESETS: Record<ThemePresetKey, ThemePreset> = {
  terracotta: {
    key: "terracotta",
    label: "Terracotta",
    accent: "#c2693f",
    accentHover: "#a8542f",
    accentSoft: "#f6e6dc",
    ring: "#c2693f",
    gradientFrom: "#e8846a",
    gradientTo: "#f5b89a",
  },
  rose: {
    key: "rose",
    label: "Rosé",
    accent: "#c25f7a",
    accentHover: "#a64862",
    accentSoft: "#f7e3ea",
    ring: "#c25f7a",
    gradientFrom: "#e8849a",
    gradientTo: "#f5b0c0",
  },
  sage: {
    key: "sage",
    label: "Sage",
    accent: "#6f8f6a",
    accentHover: "#577352",
    accentSoft: "#e6efe2",
    ring: "#6f8f6a",
    gradientFrom: "#8faf8a",
    gradientTo: "#b5d4b0",
  },
  plum: {
    key: "plum",
    label: "Plum",
    accent: "#8a5fa3",
    accentHover: "#714a89",
    accentSoft: "#efe6f5",
    ring: "#8a5fa3",
    gradientFrom: "#aa7fc3",
    gradientTo: "#ccb0e0",
  },
  ocean: {
    key: "ocean",
    label: "Ocean",
    accent: "#3f8aa3",
    accentHover: "#2f6f87",
    accentSoft: "#dcebef",
    ring: "#3f8aa3",
    gradientFrom: "#5faac3",
    gradientTo: "#90ccd8",
  },
  honey: {
    key: "honey",
    label: "Honey",
    accent: "#c2902f",
    accentHover: "#a8771f",
    accentSoft: "#f6eed2",
    ring: "#c2902f",
    gradientFrom: "#d4a84a",
    gradientTo: "#e8c882",
  },
};

/** Ordered list for rendering swatches in Settings */
export const THEME_PRESET_KEYS: ThemePresetKey[] = [
  "terracotta",
  "rose",
  "sage",
  "plum",
  "ocean",
  "honey",
];

/** Default preset — used when cookie is absent or unrecognised */
export const DEFAULT_THEME_PRESET: ThemePresetKey = "terracotta";

/**
 * Cookie name persisted on login and on theme switch.
 * SSR layout reads this to set data-theme without a DB round-trip.
 */
export const THEME_COOKIE_NAME = "vivu_theme";

/**
 * Validates an arbitrary string against the preset registry.
 * Returns a safe key, falling back to the default.
 */
export function resolveThemeKey(raw: string | undefined): ThemePresetKey {
  if (raw && raw in THEME_PRESETS) {
    return raw as ThemePresetKey;
  }
  return DEFAULT_THEME_PRESET;
}
