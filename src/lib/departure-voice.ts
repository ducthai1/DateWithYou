/*
 * The line spoken once, as the ride begins.
 *
 * It earns its place three ways. It tells the rider the two numbers they want
 * before setting off — how far, how long — at the one moment they can still
 * look at the screen. It is proof the voice works: every announcement after it
 * waits on a distance threshold, so a rider who heard nothing for the first
 * kilometre had no way to tell a broken voice from a straight road. And on iOS
 * it is the utterance that opens the audio route, because it is fired by the
 * tap that starts the ride, which is the only moment the platform allows it.
 *
 * Kept short on purpose. This is the one instruction a rider has not asked for,
 * so it says its piece in about four seconds and then leaves the road alone.
 */

import { fmtMetresVi } from "@/lib/maneuver-vi";

/** Seconds → "13 phút" / "1 tiếng 20 phút", written the way it is read aloud. */
export function spokenDuration(seconds: number): string {
  const mins = Math.max(1, Math.ceil(seconds / 60));
  if (mins < 60) return `${mins} phút`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${h} tiếng ${rem} phút` : `${h} tiếng`;
}

/*
 * Openers rotate by the day, not at random.
 *
 * Variety keeps a line that plays on every single ride from wearing out, but a
 * ride is not the place to be surprised — and a fixed choice per day means what
 * a rider hears this morning is what they heard when they set off earlier, so
 * it reads as the app's voice rather than as a slot machine.
 */
const OPENERS = [
  "Bắt đầu thôi!",
  "Lên đường nha!",
  "Đi thôi!",
  "Xuất phát nhé!",
];

/** A name too long to read aloud is worse than no name. */
const NAME_LIMIT = 40;

export function departureSentence({
  destination,
  metres,
  seconds,
  partnerOnTheWay = false,
  dayIndex = 0,
}: {
  destination?: string | null;
  metres?: number | null;
  seconds?: number | null;
  partnerOnTheWay?: boolean;
  dayIndex?: number;
}): string {
  const parts: string[] = [OPENERS[Math.abs(dayIndex) % OPENERS.length]];

  const name = destination?.trim();
  const where = name && name.length <= NAME_LIMIT ? `Tới ${name} ` : "";

  const numbers: string[] = [];
  if (metres != null && metres > 0) numbers.push(fmtMetresVi(metres));
  if (seconds != null && seconds > 0) numbers.push(spokenDuration(seconds));

  if (numbers.length) {
    // "Khoảng" starts the sentence when there is no destination to lead with.
    parts.push(where ? `${where}khoảng ${numbers.join(", ")}.` : `Khoảng ${numbers.join(", ")}.`);
  } else if (where) {
    // No route figures yet — say where we are going and stop there rather than
    // inventing a distance.
    parts.push(`${where.trim()}.`);
  }

  parts.push(partnerOnTheWay ? "Người kia cũng đang trên đường rồi." : "Đi cẩn thận nhé.");
  return parts.join(" ");
}
