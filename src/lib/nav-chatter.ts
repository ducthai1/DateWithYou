/*
 * What guidance says when there is nothing to turn at.
 *
 * The turn instructions were never the gap. The gap was the six kilometres
 * between two of them, where a rider heard nothing at all from the moment they
 * finished one turn until 500 m before the next — long enough to wonder whether
 * the app was still awake, and long enough to check the screen while moving,
 * which is the one thing spoken guidance exists to avoid.
 *
 * So a long stretch is announced when it begins, counted down while it runs,
 * and a re-route says so out loud instead of silently redrawing.
 *
 * These lines are deliberately warmer than the manoeuvre sentences, which stay
 * exactly as they were: those are commands and want to be terse and identical
 * every time. These are company on a straight road, so they vary — and they are
 * the reason to build a satnav for two people rather than use the one everybody
 * already has.
 *
 * Punctuation is kept to full stops and commas. An em dash is not a pause to a
 * speech engine, it is an unknown character, and what it does with one differs
 * by platform — which is the last thing a line meant to sound friendly needs.
 */

import { fmtMetresVi, maneuverVerb, type Maneuver } from "@/lib/maneuver-vi";

/**
 * Milestones down a long stretch, far to near.
 *
 * Only the nearest crossed one speaks, so a 6 km road gives 4 km, 2 km, 1 km
 * and then hands over to the manoeuvre stages at 500 m — six spoken moments
 * across the stretch instead of one.
 */
export const LONG_STAGES = [4000, 2000, 1000] as const;

/**
 * A stretch long enough to be worth announcing when it starts.
 *
 * 1500, not the 2000 that first suggested itself: measured against a real
 * 7.8 km route across Saigon, a 2 km floor caught one stretch of three and left
 * a 1.87 km and a 1.51 km run in the same silence that prompted this. Below
 * about a kilometre and a half the 500 m call arrives soon enough on its own.
 */
export const LONG_LEG_M = 1500;

/**
 * A line from the set, varied per call.
 *
 * `seed` exists so a whole ride can be simulated and read back — the phrasing
 * is the thing being checked, and it cannot be checked if it is different every
 * run. Left out in the app, where the point is that it is not predictable.
 */
export function pick<T>(list: readonly T[], seed?: number): T {
  const i = seed == null ? Math.floor(Math.random() * list.length) : Math.abs(seed) % list.length;
  return list[i];
}

const OPENERS_WITH_STREET = [
  (d: string, s: string) => `Đoạn này dài đấy. Thẳng một mạch ${d} trên ${s}, cứ thong thả nhé.`,
  (d: string, s: string) => `Xong khúc rẽ rồi. Giờ ${d} đường thẳng trên ${s}, tha hồ ngắm phố.`,
  (d: string, s: string) => `${d} nữa mới tới khúc rẽ tiếp theo. Cứ theo ${s} mà đi, không cần nhìn máy đâu.`,
  (d: string, s: string) => `Vào ${s} rồi. Đường này thẳng ${d}, mình nhắc lại khi gần tới nhé.`,
] as const;

const OPENERS_NO_STREET = [
  (d: string) => `Đoạn này dài đấy. Thẳng ${d} nữa mới có khúc rẽ, cứ thong thả nhé.`,
  (d: string) => `Xong khúc rẽ rồi. Còn ${d} đường thẳng, mình nhắc lại khi gần tới.`,
  (d: string) => `${d} nữa mới phải rẽ. Không cần nhìn máy đâu.`,
] as const;

/** Said once, on the step that finishes a turn onto a long road. */
export function longLegOpener({
  street,
  metres,
  seed,
}: {
  street?: string | null;
  metres: number;
  seed?: number;
}): string {
  const d = fmtMetresVi(metres);
  const s = street?.trim();
  return s ? pick(OPENERS_WITH_STREET, seed)(d, s) : pick(OPENERS_NO_STREET, seed)(d);
}

const PROGRESS = [
  (d: string) => `Còn ${d} nữa thôi, vẫn đi thẳng nhé.`,
  (d: string) => `Đang đi tốt lắm. Còn ${d}.`,
  (d: string) => `Còn ${d}. Vẫn đường này thôi.`,
  (d: string) => `Qua được kha khá rồi, còn ${d}.`,
] as const;

const NEARING = [
  (d: string, v: string) => `Sắp tới khúc ${v} rồi, còn khoảng ${d} nữa thôi.`,
  (d: string, v: string) => `Chuẩn bị ${v} nha, còn ${d}.`,
  (d: string, v: string) => `Còn ${d} là ${v} rồi đấy.`,
] as const;

/**
 * A milestone on the way down a long stretch.
 *
 * The last one before the manoeuvre stages take over names the turn that is
 * coming, because by then it is close enough to be worth thinking about; the
 * ones further out do not, because "rẽ trái sau 4 ki lô mét" is a fact nobody
 * can hold on to and it makes the line longer than the road it describes.
 */
export function longLegProgress({
  metres,
  upcoming,
  seed,
}: {
  metres: number;
  upcoming?: Maneuver | null;
  seed?: number;
}): string {
  const d = fmtMetresVi(metres);
  const near = metres <= LONG_STAGES[LONG_STAGES.length - 1] && upcoming != null;
  if (!near) return pick(PROGRESS, seed)(d);
  /*
   * Arrival is not a turn. `maneuverVerb` renders types 4-6 as "đã tới đích",
   * which reads as "sắp tới khúc đã tới đích rồi" once it is dropped into a
   * sentence built for corners.
   */
  if (upcoming.type >= 4 && upcoming.type <= 6) return pick(ARRIVING, seed)(d);
  return pick(NEARING, seed)(d, maneuverVerb(upcoming.type));
}

const ARRIVING = [
  (d: string) => `Còn ${d} là tới đích rồi.`,
  (d: string) => `Gần tới rồi, còn khoảng ${d}.`,
  (d: string) => `Còn ${d} nữa là đến nơi.`,
] as const;

const ARRIVE_NAME_SIDE = [
  (n: string, h: string) => `Tới rồi! ${n} nằm bên ${h} bạn đó.`,
  (n: string, h: string) => `Đến nơi rồi nha. ${n} ở bên ${h} thôi, khỏi phải tìm.`,
  (n: string, h: string) => `${n} đây rồi, bên ${h} bạn. Chuyến này đi ngon lành.`,
  (n: string, h: string) => `Vậy là tới. Ngó sang bên ${h} là thấy ${n} nhé.`,
] as const;

const ARRIVE_NAME = [
  (n: string) => `Tới rồi! ${n} ngay quanh đây thôi.`,
  (n: string) => `Đến nơi rồi nha, ${n} đây rồi.`,
  (n: string) => `${n} đây rồi. Chuyến này đi ngon lành.`,
] as const;

const ARRIVE_SIDE = [
  (h: string) => `Tới rồi! Điểm đến nằm bên ${h} bạn đó.`,
  (h: string) => `Đến nơi rồi nha, ngó sang bên ${h} là thấy.`,
  (h: string) => `Vậy là tới. Chỗ mình cần ở bên ${h} thôi.`,
] as const;

const ARRIVE_PLAIN = [
  "Tới rồi! Chuyến này đi ngon lành.",
  "Đến nơi rồi nha. Nghỉ chân thôi.",
  "Vậy là tới. Đi cẩn thận nhé, hẹn chuyến sau.",
] as const;

/**
 * The last thing said on a ride.
 *
 * Names the place and which hand it is on, because that is the question a rider
 * is left holding when the route ends: the line stops where the road comes
 * closest to the place, and the place is a few metres off to one side. Being
 * told is the difference between stopping once and looking both ways at walking
 * pace in traffic.
 *
 * Side and name are both optional and the sentence is built from whichever
 * exist. A missing side is not a gap to apologise for — `destinationSide`
 * returns nothing when the pin is on the road or nearly straight ahead, and in
 * those cases there is genuinely no hand to name.
 */
export function arrivalLine({
  name,
  side,
  seed,
}: {
  name?: string | null;
  side?: "left" | "right" | null;
  seed?: number;
}): string {
  const n = name?.trim() || null;
  const h = side === "left" ? "trái" : side === "right" ? "phải" : null;
  if (n && h) return pick(ARRIVE_NAME_SIDE, seed)(n, h);
  if (n) return pick(ARRIVE_NAME, seed)(n);
  if (h) return pick(ARRIVE_SIDE, seed)(h);
  return pick(ARRIVE_PLAIN, seed);
}

const REROUTE = [
  "Ơ, bạn có lựa chọn riêng rồi ư? Mình vừa vẽ lại đường theo lối bạn đi.",
  "Đi lối này cũng hay. Đường mới vẽ xong rồi nhé.",
  "Không sao, mình tính lại đường theo cách bạn chọn rồi.",
  "Bạn rẽ hướng khác à? Được thôi, đường mới đây rồi.",
  "Mình chạy theo bạn thôi. Đường đã vẽ lại xong, cứ đi tiếp nhé.",
  "Lối này của bạn nghe hay đấy. Mình dẫn tiếp theo đường mới nha.",
] as const;

/**
 * Said when the route is redrawn under someone who went their own way.
 *
 * Never phrased as a correction. A rider who took a different street usually
 * had a reason — a closed road, a shortcut they know, a stop they wanted — and
 * being told off by a phone for knowing the city better than it does is a small
 * thing that adds up over a lot of rides.
 */
export function rerouteLine(seed?: number): string {
  return pick(REROUTE, seed);
}
