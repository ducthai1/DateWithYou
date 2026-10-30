/**
 * A partner's battery level, or null once it is too old to mean anything.
 *
 * An iPhone's level comes only from its background tracker (Safari has no
 * Battery API), and an app ping without a level leaves the tracker's in place
 * rather than wiping it — so a level can outlive the tracker that sent it.
 */
export const BATTERY_FRESH_MS = 30 * 60_000;

export function freshBattery(
  level: number | null | undefined,
  at: Date | string | null | undefined,
  now = Date.now(),
): number | null {
  if (level == null) return null;
  // Written before levels carried a time; such rows expire within the hour.
  if (!at) return level;
  return now - new Date(at).getTime() <= BATTERY_FRESH_MS ? level : null;
}
