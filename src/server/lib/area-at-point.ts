import { matchArea } from "@/lib/vn-admin";

/**
 * Which administrative area a coordinate falls in, as an official 2025 unit.
 *
 * Two providers, in order of how well they answer for Vietnam:
 *
 * 1. TrackAsia, which the app already has a key for. It returns the post-reform
 *    units directly (`administrative_area_level_2` is the ward, `_1` the
 *    province) and answers in a few hundred milliseconds.
 * 2. Nominatim, keyless and rate-limited, as a fallback for when the first is
 *    down or unkeyed.
 *
 * Either way the answer is only a hint: it is matched against the official list
 * before being returned, because OpenStreetMap still carries plenty of pre-2025
 * district names that are no longer units at all.
 *
 * Best-effort by design — short timeouts, null on any failure.
 */

const TIMEOUT_MS = 4000;

type Area = ReturnType<typeof matchArea>;

async function fromTrackAsia(lat: number, lng: number): Promise<Area | null> {
  const key = process.env.TRACKASIA_API_KEY;
  if (!key) return null;
  const url =
    `https://maps.track-asia.com/api/v2/geocode/json` +
    `?latlng=${lat},${lng}&new_admin=true&key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status?: string;
    results?: Array<{ address_components?: Array<{ types?: string[]; long_name?: string }> }>;
  };
  if (data.status !== "OK") return null;
  const parts = data.results?.[0]?.address_components ?? [];
  const pick = (type: string) =>
    parts.find((c) => c.types?.includes(type))?.long_name ?? undefined;
  return matchArea(pick("administrative_area_level_2"), pick("administrative_area_level_1"));
}

async function fromNominatim(lat: number, lng: number): Promise<Area | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14` +
    `&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      "User-Agent": "DateWithYou/1.0 (couple-space app; area lookup)",
      "Accept-Language": "vi",
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { address?: Record<string, string | undefined> };
  const a = data.address ?? {};
  const ward = a.suburb ?? a.quarter ?? a.village ?? a.town ?? a.city_district;
  const province = a.city ?? a.state ?? a.province;
  return matchArea(ward, province);
}

export async function areaAtPoint(lat: number, lng: number): Promise<Area | null> {
  for (const provider of [fromTrackAsia, fromNominatim]) {
    try {
      const hit = await provider(lat, lng);
      if (hit) return hit;
    } catch (err) {
      console.error("areaAtPoint: provider failed", err);
    }
  }
  return null;
}
