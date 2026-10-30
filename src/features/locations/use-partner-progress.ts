import { useMemo } from "react";
import { cumulativeMetres, remainingAlongRoute } from "@/lib/route-geometry";
import type { PartnerLocation } from "./use-live-navigation";

type Progress = { meters: number | null; seconds: number | null };

/**
 * How far the partner still has to go, and how long — while riding together.
 *
 * The partner column used to show the distance and time of the route fetched
 * for them at departure, and never anything else: forty minutes in, it still
 * said what it said at the door, and "bạn sẽ đến trễ hơn X phút" compared a
 * live number on this side with that frozen one on theirs.
 *
 * Best is what their own phone measured — their GPS, their route, their pace —
 * which it now sends with every position. A phone that does not (not
 * navigating, or an older build still open) gets this side's estimate instead:
 * their live position matched onto the route drawn for them, at that route's
 * own pace. The departure numbers are only the last resort.
 */
export function partnerProgress(
  partner: Pick<PartnerLocation, "lat" | "lng" | "remainingMeters" | "remainingSeconds"> | null,
  coords: Array<[number, number]> | null,
  cum: number[] | null,
  totalMeters: number | null,
  totalSeconds: number | null,
): Progress {
  if (partner?.remainingMeters != null && partner.remainingSeconds != null)
    return { meters: partner.remainingMeters, seconds: partner.remainingSeconds };
  if (partner && coords && cum && totalMeters && totalSeconds) {
    const { remaining } = remainingAlongRoute({ lat: partner.lat, lng: partner.lng }, coords, cum);
    return { meters: remaining, seconds: Math.round(remaining * (totalSeconds / totalMeters)) };
  }
  return { meters: totalMeters, seconds: totalSeconds };
}

export function usePartnerProgress(
  partner: PartnerLocation | null,
  geometry: unknown,
  totalMeters: number | null,
  totalSeconds: number | null,
): Progress {
  const coords = (geometry as { coordinates?: Array<[number, number]> } | null)?.coordinates ?? null;
  const cum = useMemo(() => (coords && coords.length > 1 ? cumulativeMetres(coords) : null), [coords]);
  return useMemo(
    () => partnerProgress(partner, coords, cum, totalMeters, totalSeconds),
    [partner, coords, cum, totalMeters, totalSeconds],
  );
}
