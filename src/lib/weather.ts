/**
 * Whether it is going to rain on the afternoon being planned.
 *
 * A day planner that schedules a walk by the river into a 100% chance of rain
 * is not planning anybody's day. Open-Meteo answers this with no key, no
 * account and no card, which is the only reason it is here — see
 * `sources/datewithyou/docs/nguon-du-lieu-mien-phi-khong-can-the.md`.
 *
 * The rule is to WARN, never to silently rearrange. Somebody who has already
 * decided to go out in the rain does not need the app disagreeing with them;
 * they need to know to bring a coat. Reading the forecast and rewriting the
 * plan behind their back is the kind of helpfulness that reads as a bug.
 *
 * Pure: the fetching lives in src/server/lib/fetch-weather.ts.
 */

export type HourlyWeather = {
  /** "HH:mm", local. */
  time: string;
  /** 0–100. */
  rainChance: number;
  tempC: number | null;
};

/** At or above this, a stop in the open air gets a line about it. */
export const RAIN_LIKELY_PCT = 60;
/** At or above this, it is worth saying on the plan as a whole. */
export const RAIN_HEAVY_PCT = 80;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Open-Meteo's hourly block → the hours of one day.
 *
 * Its `time` entries are "YYYY-MM-DDTHH:mm" in the timezone that was asked
 * for, so the day is filtered by string prefix rather than by parsing into a
 * Date and back — which is the same reason the rest of this app keeps day keys
 * as strings.
 */
export function mapForecast(body: unknown, dateKey: string): HourlyWeather[] {
  if (!isObj(body) || !isObj(body.hourly)) return [];
  const h = body.hourly;
  if (!Array.isArray(h.time)) return [];
  const rain = Array.isArray(h.precipitation_probability) ? h.precipitation_probability : [];
  const temp = Array.isArray(h.temperature_2m) ? h.temperature_2m : [];

  const out: HourlyWeather[] = [];
  h.time.forEach((stamp, i) => {
    if (typeof stamp !== "string" || !stamp.startsWith(`${dateKey}T`)) return;
    const chance = rain[i];
    out.push({
      time: stamp.slice(11, 16),
      rainChance: typeof chance === "number" ? Math.round(chance) : 0,
      tempC: typeof temp[i] === "number" ? Math.round(temp[i] as number) : null,
    });
  });
  return out;
}

/** The forecast for the hour a stop starts in, or null when unknown. */
export function atHour(hours: HourlyWeather[], startTime: string): HourlyWeather | null {
  const hh = startTime.slice(0, 2);
  return hours.find((h) => h.time.slice(0, 2) === hh) ?? null;
}

/**
 * One line about the weather over a set of stop times, or null when there is
 * nothing worth saying. Silence is the common and correct answer.
 */
export function rainHeadline(hours: HourlyWeather[], startTimes: string[]): string | null {
  const relevant = startTimes
    .map((t) => atHour(hours, t))
    .filter((h): h is HourlyWeather => h !== null);
  if (!relevant.length) return null;
  const worst = relevant.reduce((a, b) => (b.rainChance > a.rainChance ? b : a));
  if (worst.rainChance < RAIN_LIKELY_PCT) return null;
  const when = `${worst.time.slice(0, 2)}h`;
  return worst.rainChance >= RAIN_HEAVY_PCT
    ? `Khoảng ${when} nhiều khả năng mưa (${worst.rainChance}%) — mang theo áo mưa nhé.`
    : `Khoảng ${when} có thể mưa (${worst.rainChance}%).`;
}

/** Kinds of stop that are no fun in the rain. */
const OUTDOOR = new Set(["stroll"]);

/** A warning for one stop, or null. */
export function rainWarningFor(
  hours: HourlyWeather[],
  stop: { kind: string; startTime: string },
): string | null {
  if (!OUTDOOR.has(stop.kind)) return null;
  const h = atHour(hours, stop.startTime);
  if (!h || h.rainChance < RAIN_LIKELY_PCT) return null;
  return `Chặng ngoài trời mà giờ này khả năng mưa ${h.rainChance}% — đổi chặng hoặc mang áo mưa.`;
}
