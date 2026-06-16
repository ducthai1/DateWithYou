// Central map from semantic string keys to Lucide icon components.
// Centralising here keeps icon imports DRY and gives a single fallback point
// for legacy stored emoji strings (old tag.icon values from DB / seeds).

import {
  Sunrise,
  Sun,
  CloudSun,
  Moon,
  Heart,
  UtensilsCrossed,
  Plane,
  Gift,
  ListChecks,
  Sparkles,
  HeartHandshake,
  Users,
  Music,
  Utensils,
  ChefHat,
  Disc3,
  // Special-date icons — added to support the icon picker in SpecialDatesPanel
  Cake,
  CalendarHeart,
  Star,
  MapPin,
  type LucideIcon,
} from "lucide-react";

// All registered semantic keys. Downstream components use this type to signal
// they accept a key string, not a raw emoji.
export type IconKey =
  // Buckets
  | "sunrise"
  | "sun"
  | "cloud-sun"
  | "moon"
  // Default tags
  | "heart"
  | "utensils-crossed"
  | "plane"
  | "gift"
  | "list-checks"
  | "sparkles"
  // App chrome
  | "heart-handshake"
  | "users"
  // Library types
  | "music"
  | "utensils"
  | "chef-hat"
  | "disc3"
  // Special-date picker icons
  | "cake"
  | "calendar-heart"
  | "star"
  // Places
  | "map-pin";

const ICON_MAP: Record<IconKey, LucideIcon> = {
  // Buckets — time-of-day
  sunrise: Sunrise,
  sun: Sun,
  "cloud-sun": CloudSun,
  moon: Moon,
  // Tags
  heart: Heart,
  "utensils-crossed": UtensilsCrossed,
  plane: Plane,
  gift: Gift,
  "list-checks": ListChecks,
  sparkles: Sparkles,
  // App chrome
  "heart-handshake": HeartHandshake,
  users: Users,
  // Library media types
  music: Music,
  utensils: Utensils,
  "chef-hat": ChefHat,
  disc3: Disc3,
  // Special-date picker
  cake: Cake,
  "calendar-heart": CalendarHeart,
  star: Star,
  // Places (also the neutral fallback glyph)
  "map-pin": MapPin,
};

// Fallback shown when the stored key is unknown (e.g. legacy emoji string from DB).
// MapPin is neutral and unambiguous — it won't be confused with any content icon.
const FALLBACK: LucideIcon = MapPin;

/**
 * Returns the Lucide component for a registry key.
 * Unknown/undefined keys (including legacy emoji strings) receive the fallback —
 * no crash, no blank render.
 */
export function resolveIcon(key?: string): LucideIcon {
  if (key && key in ICON_MAP) {
    return ICON_MAP[key as IconKey];
  }
  return FALLBACK;
}
