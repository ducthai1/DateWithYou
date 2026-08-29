import type { ArtName } from "@/lib/tone";

/**
 * Which illustration stands in for a day that has no photo of its own.
 *
 * Shared by the month cell and the mobile day cover so the same date shows the
 * same picture in both, and so the two cannot drift apart when the list changes.
 *
 * Only pieces that exist in BOTH tones are eligible: a day is decoration, and a
 * cell silently falling back to the other palette would put one warm tile in a
 * cool month for no reason a reader could explain.
 */
export const DAY_ART: ArtName[] = [
  "heroDesk",
  "appShowcase",
  "mapIsland",
  "memoriesScrapbook",
  "wheelFood",
];

/** Stable across renders and month navigation — derived, never random. */
export function hashKey(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

/**
 * The picture for a date key ("YYYY-MM-DD").
 *
 * Deliberately NOT Math.random: a picture that changes on every render, or
 * every time you page back to a month, reads as a glitch rather than as
 * variety.
 */
export function artForDate(dateKey: string): ArtName {
  return DAY_ART[hashKey(dateKey) % DAY_ART.length];
}
