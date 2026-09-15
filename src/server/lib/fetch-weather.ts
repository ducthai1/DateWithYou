import { mapForecast, type HourlyWeather } from "@/lib/weather";

/**
 * Asking Open-Meteo whether the afternoon is going to be wet.
 *
 * Chosen because it needs no key, no account and no card — the owner of this
 * app has none of those for a weather service, and this is the only provider
 * that does not ask. Free for non-commercial use up to 10,000 calls a day,
 * under CC BY 4.0, which is why the plan screen credits it.
 *
 * Failure here is never an error: the plan is complete without a forecast, and
 * a weather service being down is not a reason for somebody not to get their
 * afternoon. Every path returns an empty list.
 *
 * The endpoint is configurable because Open-Meteo is open source and people do
 * self-host it — and because setting it empty turns the forecast off, which is
 * what the test harness does to keep the suites off the network.
 */

const TIMEOUT_MS = 2_500;
/** Weather changes slowly; the same corner an hour later is the same answer. */
const CACHE_TTL_MS = 30 * 60_000;
const CACHE_MAX = 100;

const cache = new Map<string, { at: number; hours: HourlyWeather[] }>();

/** ~1.1 km cells: the forecast does not differ inside one. */
const cellOf = (geo: { lat: number; lng: number }) =>
  `${geo.lat.toFixed(2)},${geo.lng.toFixed(2)}`;

export async function fetchForecast(
  geo: { lat: number; lng: number },
  dateKey: string,
): Promise<HourlyWeather[]> {
  if (process.env.WEATHER_API_BASE === "") return [];
  const key = `${cellOf(geo)}|${dateKey}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.hours;

  const base = process.env.WEATHER_API_BASE ?? "https://api.open-meteo.com/v1/forecast";
  if (!base) return [];
  const url = new URL(base);
  url.searchParams.set("latitude", geo.lat.toFixed(4));
  url.searchParams.set("longitude", geo.lng.toFixed(4));
  url.searchParams.set("hourly", "precipitation_probability,temperature_2m");
  // Asked in Saigon time so the hours line up with the day keys this app uses
  // everywhere else, rather than needing a conversion nobody would remember.
  url.searchParams.set("timezone", "Asia/Bangkok");
  url.searchParams.set("start_date", dateKey);
  url.searchParams.set("end_date", dateKey);

  const ctrl = new AbortController();
  const deadline = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return [];
    const hours = mapForecast(await res.json().catch(() => null), dateKey);
    if (hours.length) {
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
      cache.set(key, { at: Date.now(), hours });
    }
    return hours;
  } catch {
    return [];
  } finally {
    clearTimeout(deadline);
  }
}

/** Test seam: the cache is process-wide and would leak between suites. */
export function __clearWeatherCache() {
  cache.clear();
}
