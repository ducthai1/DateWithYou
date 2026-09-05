/**
 * Valhalla's turn list, in Vietnamese.
 *
 * The router answers in English ("Turn right onto Nguyễn Huệ") and its own
 * locale files do not cover Vietnamese, so the sentence is built here from the
 * three facts that matter — what kind of turn, onto what street, how far away —
 * rather than translated. Building it also means the distance can be spoken the
 * way a person says it ("ba trăm mét" reads as "300 m" on screen but the phrase
 * is the same string either way), and the wording can change without a router
 * round trip.
 *
 * Type numbers are Valhalla's `maneuver.type` enum. Anything unlisted falls
 * back to "đi tiếp", which is always true and never wrong.
 */

export type Maneuver = {
  type: number;
  streetNames: string[];
  /** Length of the step that begins at this maneuver. */
  distanceMeters: number;
  /*
   * Posted limit, km/h — carried but not currently shown.
   *
   * Measured against a real Saigon route: the router returned it for ZERO of 16
   * manoeuvres, so a badge built on it would never appear. The field stays
   * because parsing it costs nothing and the data may improve; anything that
   * displays it must handle null as the normal case, not the exception.
   */
  speedLimitKmh?: number | null;
  lat: number;
  lng: number;
  /**
   * How far along this leg's polyline the manoeuvre sits, in metres.
   *
   * The reason guidance needs this rather than a coordinate: a straight line to
   * a corner is not the distance to it. On a route that bends it is short by a
   * fifth or more, and on one that doubles back it is meaningless — a U-turn
   * puts everything after it a few metres from everything before it, so the
   * nearest corner as the crow flies can be a kilometre away by road.
   *
   * Optional because a route cached before this existed has none, and straight
   * line is still better than nothing.
   */
  alongRouteMeters?: number | null;
  /**
   * For a roundabout-enter manoeuvre (type 26): which exit to take, 1-based,
   * as the router counts them. Absent for every other manoeuvre — and for a
   * roundabout the router did not count — then it is the plain "vào vòng xuyến".
   */
  roundaboutExitCount?: number | null;
};

/** Which way, as a person would say it. */
const VERBS: Record<number, string> = {
  1: "đi thẳng",
  2: "đi thẳng",
  3: "đi thẳng",
  4: "đã tới đích",
  5: "đã tới đích",
  6: "đã tới đích",
  7: "đi tiếp",
  8: "đi thẳng",
  9: "chếch phải",
  10: "rẽ phải",
  11: "ngoặt phải",
  12: "quay đầu",
  13: "quay đầu",
  14: "ngoặt trái",
  15: "rẽ trái",
  16: "chếch trái",
  17: "đi thẳng theo đường nhánh",
  18: "vào nhánh bên phải",
  19: "vào nhánh bên trái",
  20: "ra bên phải",
  21: "ra bên trái",
  22: "đi thẳng",
  23: "giữ bên phải",
  24: "giữ bên trái",
  25: "nhập làn",
  26: "vào vòng xuyến",
  27: "ra khỏi vòng xuyến",
  28: "lên phà",
  29: "xuống phà",
};

/** The arrow to draw. Grouped, because a banner needs a direction, not a verb. */
export type ManeuverArrow =
  | "straight"
  | "left"
  | "right"
  | "slight-left"
  | "slight-right"
  | "sharp-left"
  | "sharp-right"
  | "uturn"
  | "roundabout"
  | "destination";

const ARROWS: Record<number, ManeuverArrow> = {
  4: "destination",
  5: "destination",
  6: "destination",
  9: "slight-right",
  10: "right",
  11: "sharp-right",
  12: "uturn",
  13: "uturn",
  14: "sharp-left",
  15: "left",
  16: "slight-left",
  18: "right",
  19: "left",
  20: "right",
  21: "left",
  23: "slight-right",
  24: "slight-left",
  26: "roundabout",
  27: "roundabout",
};

export function maneuverVerb(type: number): string {
  return VERBS[type] ?? "đi tiếp";
}

export function maneuverArrow(type: number): ManeuverArrow {
  return ARROWS[type] ?? "straight";
}

/** True for the turns worth interrupting someone about. */
export function isRealTurn(type: number): boolean {
  const a = ARROWS[type];
  return a != null && a !== "destination";
}

/**
 * Distance as a person says it.
 *
 * Rounded coarsely on purpose: "sau 327 mét" is precision nobody can use while
 * riding, and it makes the spoken line longer than the gap it describes.
 */
export function fmtMetresVi(m: number): string {
  if (m >= 975) {
    const km = m / 1000;
    if (km >= 10) return `${Math.round(km)} ki lô mét`;
    const one = km.toFixed(1);
    // "1,0 ki lô mét" is not something anyone says, and the tenth is noise at
    // that range anyway. The 975 threshold is what keeps the metre branch from
    // rounding up to "1000 mét" and sitting oddly beside this one.
    return one.endsWith(".0")
      ? `${one.slice(0, -2)} ki lô mét`
      : `${one.replace(".", ",")} ki lô mét`;
  }
  if (m >= 100) return `${Math.round(m / 50) * 50} mét`;
  return `${Math.max(10, Math.round(m / 10) * 10)} mét`;
}

/**
 * The street the turn leads onto, when the router named one.
 *
 * Withheld for a U-turn: you do not turn "vào" a street you are already on, and
 * "quay đầu vào Hai Bà Trưng" reads as an instruction to enter somewhere.
 * Roundabouts get the same treatment — the name belongs to the exit, not to the
 * circle.
 */
export function maneuverStreet(m: Maneuver): string | null {
  if (m.type === 12 || m.type === 13 || m.type === 26) return null;
  const name = m.streetNames.filter(Boolean)[0];
  return name ? name.trim() : null;
}

/**
 * The line to speak and to show.
 *
 * `metres` is how far the person is from the turn right now, not the length of
 * the step — those differ the whole way along it, and the useful one is the gap
 * still to close. Below `IMMINENT_M` the distance is dropped entirely: at that
 * range "rẽ phải ngay" is the instruction, and a number is noise.
 */
export const IMMINENT_M = 40;

/** Vietnamese ordinals for roundabout exits; 1 and 4 are irregular. */
const EXIT_ORDINALS: Record<number, string> = {
  1: "thứ nhất", 2: "thứ hai", 3: "thứ ba", 4: "thứ tư", 5: "thứ năm",
  6: "thứ sáu", 7: "thứ bảy", 8: "thứ tám", 9: "thứ chín",
};

/** "vào vòng xuyến, ra lối thứ ba" — or the plain form when no exit was counted. */
function roundaboutPhrase(n?: number | null): string {
  if (!n || n < 1) return "vào vòng xuyến";
  return `vào vòng xuyến, ra lối ${EXIT_ORDINALS[n] ?? `thứ ${n}`}`;
}

/**
 * The core of the instruction — the verb and where it leads — without the
 * distance or the softener. A roundabout says which exit to take; everything
 * else says the verb and the street it turns onto.
 */
function maneuverCore(m: Maneuver): string {
  if (m.type === 26) return roundaboutPhrase(m.roundaboutExitCount);
  const verb = maneuverVerb(m.type);
  const street = maneuverStreet(m);
  return street ? `${verb} vào ${street}` : verb;
}

/** Whether the core carries a detail (a street, or a counted roundabout exit). */
function maneuverHasDetail(m: Maneuver): boolean {
  return m.type === 26 ? !!m.roundaboutExitCount : !!maneuverStreet(m);
}

export function maneuverSentence(m: Maneuver, metres: number): string {
  if (m.type >= 4 && m.type <= 6) {
    // "Đã tới đích" is what a system says. This is the end of someone's ride.
    return metres <= IMMINENT_M ? "Tới rồi!" : `Còn ${fmtMetresVi(metres)} là tới đích`;
  }
  const core = maneuverCore(m);
  if (metres <= IMMINENT_M) {
    /*
     * "Rẽ phải vào Pasteur nha", not "Rẽ phải ngay vào Pasteur". A guide, not a
     * dispatcher: the softener goes at the END so the words that matter come
     * first. Which particle depends on whether the core names a detail (a
     * street, or which roundabout exit) — "chếch phải nha" alone is thinner
     * than "chếch phải nào".
     */
    const head = `${core.charAt(0).toUpperCase()}${core.slice(1)}`;
    return maneuverHasDetail(m) ? `${head} nha` : `${head} nào`;
  }
  return `Sau ${fmtMetresVi(metres)} ${core}`;
}

/** Short form for the banner, which has the distance in its own column. */
export function maneuverLabel(m: Maneuver): string {
  const core = maneuverCore(m);
  return `${core.charAt(0).toUpperCase()}${core.slice(1)}`;
}
