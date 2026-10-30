/**
 * OwnTracks: the small native app that keeps sending a position after the
 * screen goes off.
 *
 * A web page cannot do that on any phone — iOS gives a website "while using"
 * and nothing more, Android stops a hidden page's location, and a service
 * worker has no geolocation at all. A native tracker can, and OwnTracks is a
 * free, open-source one for both platforms that POSTs each fix as JSON to an
 * address of our choosing (its "HTTP mode"). So it rides along as the bridge:
 * it measures, Vivu's server writes the fix where the app's own pings go, and
 * the partner's map does not know the difference.
 *
 * Everything here is pure — parsing what it sends, and building the link that
 * configures it in one tap. Formats: https://owntracks.org/booklet/tech/json/
 */

/** How often it reports while riding. Chosen by the owner, 30/10/2026. */
export const TRACKER_INTERVAL_S = 25;

/**
 * On iOS, move mode reports after `locatorInterval` seconds OR
 * `locatorDisplacement` metres, whichever comes first — at the default 100 m a
 * motorbike would report every ten seconds. 500 m takes 30 s even at 60 km/h,
 * so the 25 s clock is the one that fires. Android's move mode ignores the
 * displacement and uses its own interval key instead.
 */
const IOS_DISPLACEMENT_M = 500;

/** Monitoring modes as OwnTracks numbers them. */
export const MONITORING_MOVE = 2;

export const OWNTRACKS_APP_STORE = "https://apps.apple.com/app/owntracks/id692424691";
export const OWNTRACKS_PLAY_STORE = "https://play.google.com/store/apps/details?id=org.owntracks.android";

export type TrackerFix = {
  lat: number;
  lng: number;
  /** When the fix was taken, ms — not when it arrived: a queue flushed after a tunnel arrives late. */
  at: number;
  accuracy: number | null;
  speedKmH: number | null;
  heading: number | null;
  battery: number | null;
  /** 1 significant-changes, 2 move; null when the device did not say (Android omits it). */
  monitoring: number | null;
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** A `_type: "location"` message, or null for anything else. */
export function parseOwnTracksLocation(body: unknown): TrackerFix | null {
  if (!body || typeof body !== "object") return null;
  const m = body as Record<string, unknown>;
  if (m._type !== "location") return null;
  const lat = num(m.lat);
  const lng = num(m.lon);
  const tst = num(m.tst);
  if (lat === null || lng === null || tst === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || tst <= 0) return null;
  const vel = num(m.vel);
  const cog = num(m.cog);
  const batt = num(m.batt);
  return {
    lat,
    lng,
    at: tst * 1000,
    accuracy: num(m.acc),
    // Some Android phones always send 0; a 0 we cannot trust is better as unknown.
    speedKmH: vel !== null && vel > 0 ? vel : null,
    heading: cog !== null && cog >= 0 && cog < 360 ? cog : null,
    battery: batt !== null && batt >= 0 && batt <= 100 ? Math.round(batt) : null,
    monitoring: num(m.m),
  };
}

/**
 * Whether the tracker is allowed to work in the background, as the phone
 * itself reports it.
 *
 * `location`: "ok" — it may run with the screen off; "foreground" — iOS "While
 * Using", which is not enough; "denied"; "unknown" when it did not say.
 */
export type TrackerHealth = {
  platform: "ios" | "android";
  location: "ok" | "foreground" | "denied" | "unknown";
  /** Android: the system may stop it to save battery. */
  batteryOptimized: boolean | null;
  /** Android: the phone is in power-save mode. */
  powerSave: boolean | null;
  /** Android: the system may put it to sleep after a while unused. */
  hibernation: boolean | null;
  /** iOS: Background App Refresh is off for it. */
  backgroundRefreshOff: boolean | null;
};

/*
 * iOS sends `locationManagerAuthorizationStatus`, Apple's CLAuthorizationStatus
 * — as a name or as the raw number depending on the version, so both are read.
 * Raw values: 0 not determined, 1 restricted, 2 denied, 3 always, 4 when in use.
 */
function iosLocation(v: unknown): TrackerHealth["location"] {
  if (typeof v === "number") return v === 3 ? "ok" : v === 4 ? "foreground" : v === 1 || v === 2 ? "denied" : "unknown";
  if (typeof v !== "string") return "unknown";
  const s = v.toLowerCase().replace(/[^a-z]/g, "");
  if (s.includes("always")) return "ok";
  if (s.includes("wheninuse")) return "foreground";
  if (s.includes("denied") || s.includes("restricted")) return "denied";
  return "unknown";
}

/*
 * Android's fields are integers where 0 is "fine" and 1 is "a problem"
 * (STATUS_PASS / STATUS_FAIL in its source). Anything else is not a claim.
 */
const androidFail = (v: unknown): boolean | null => (v === 1 || v === true ? true : v === 0 || v === false ? false : null);

/** A `_type: "status"` message (the reply to our `status` command), or null. */
export function parseOwnTracksStatus(body: unknown): TrackerHealth | null {
  if (!body || typeof body !== "object") return null;
  const m = body as Record<string, unknown>;
  if (m._type !== "status") return null;
  const ios = m.iOS as Record<string, unknown> | undefined;
  if (ios && typeof ios === "object") {
    const refresh = ios.backgroundRefreshStatus;
    return {
      platform: "ios",
      location: iosLocation(ios.locationManagerAuthorizationStatus),
      batteryOptimized: null,
      powerSave: null,
      hibernation: null,
      backgroundRefreshOff:
        refresh === false || (typeof refresh === "string" && /denied|restricted/i.test(refresh))
          ? true
          : refresh === true || (typeof refresh === "string" && /available/i.test(refresh))
            ? false
            : null,
    };
  }
  const android = m.android as Record<string, unknown> | undefined;
  if (android && typeof android === "object") {
    const loc = androidFail(android.loc);
    return {
      platform: "android",
      location: loc === null ? "unknown" : loc ? "denied" : "ok",
      batteryOptimized: androidFail(android.bo),
      powerSave: androidFail(android.ps),
      hibernation: androidFail(android.hib),
      backgroundRefreshOff: null,
    };
  }
  return null;
}

/** The settings the one-tap link installs. */
export function ownTracksConfig({
  url,
  username,
  password,
  tid,
}: {
  url: string;
  username: string;
  password: string;
  tid: string;
}): Record<string, unknown> {
  return {
    _type: "configuration",
    mode: 3, // HTTP
    url,
    auth: true,
    username,
    password,
    deviceId: "vivu",
    tid,
    monitoring: MONITORING_MOVE,
    locatorInterval: TRACKER_INTERVAL_S,
    locatorDisplacement: IOS_DISPLACEMENT_M,
    moveModeLocatorInterval: TRACKER_INTERVAL_S,
    locatorPriority: 0, // Android: GPS, not the cell-tower guess
    pegLocatorFastestIntervalToInterval: true,
    // Lets the server ask which permissions it has — see parseOwnTracksStatus.
    cmd: true,
    extendedData: true,
  };
}

/** `owntracks:///config?inline=<base64 JSON>` — opens the app and imports the settings. */
export function ownTracksConfigLink(config: Record<string, unknown>): string {
  const json = JSON.stringify(config);
  const b64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(json, "utf8").toString("base64")
      : btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return `owntracks:///config?inline=${encodeURIComponent(b64)}`;
}
