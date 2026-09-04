import { daysBetweenKeys, todayKey } from "@/lib/date-keys";

/**
 * What state a trip is in, and what the calendar says about it.
 *
 * Two different things were tangled in one dropdown before. "Lên kế hoạch" and
 * "Sắp đi" both meant *not started yet* — one field spent on a distinction
 * nobody makes — while the state people actually care about, being ON the trip
 * right now, had no value at all and no way to reach it but a settings modal.
 *
 * So the set became: preparing, travelling, done. And because a trip carries
 * its own dates, the app works out where today falls on its own (`tripPhase`)
 * instead of asking a person to type in something it can already see.
 */

export const TRIP_STATUSES = ["planning", "active", "completed"] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

/**
 * The trip's state, worked out from its own dates.
 *
 * Not stored, because it was never really a choice. The dates already say
 * everything: before them a trip is being prepared, between them it is under
 * way, after them it is over. Keeping a second field for it meant a trip could
 * disagree with its own calendar, and somebody had to notice and fix it by
 * hand — a chore the app invented for itself and then had to apologise for
 * with a prompt.
 *
 * Derived also means it is never stale: a trip becomes "đang đi" at midnight on
 * the day it starts without anybody opening the app.
 */
export function tripStatus(
  startDate: string,
  endDate: string,
  today = todayKey(),
): TripStatus {
  const phase = tripPhase(startDate, endDate, today);
  if (phase === "before") return "planning";
  if (phase === "during") return "active";
  return "completed";
}

/*
 * One name per state, and the pill is that name in capitals.
 *
 * There used to be a third, shorter set for a segmented control that no longer
 * exists, and it left the app speaking two vocabularies: a trip called "Đang
 * trong hành trình" in one place wore "ĐANG ĐI" in another — which reads less
 * like a stage of a journey than like a fragment someone trimmed to fit.
 */
export const TRIP_STATUS_META: Record<
  TripStatus,
  { full: string; pill: string; hint: string }
> = {
  planning: {
    full: "Đang chuẩn bị",
    pill: "ĐANG CHUẨN BỊ",
    hint: "Còn đang lên lịch trình, gom đồ, chốt chỗ ở.",
  },
  active: {
    full: "Đang trong hành trình",
    // Without "Đang", so the badge still fits beside the day counter.
    pill: "TRONG HÀNH TRÌNH",
    hint: "Hai đứa đang trên đường — lịch trình hôm nay hiện ở trang chủ.",
  },
  completed: {
    full: "Đã hoàn thành",
    pill: "ĐÃ HOÀN THÀNH",
    hint: "Chuyến đi đã xong, giờ nằm trong kho kỷ niệm.",
  },
};

type TripPhase = "before" | "during" | "after";

/** Where today sits relative to the trip's own dates. Pure calendar comparison. */
/*
 * Internal now: every caller wants the status, not the phase behind it. Kept
 * as its own step because "where today sits" and "what to call that" are two
 * decisions, and folding them together makes both harder to read.
 */
function tripPhase(startDate: string, endDate: string, today = todayKey()): TripPhase {
  if (today < startDate) return "before";
  if (today > endDate) return "after";
  return "during";
}

/**
 * "Ngày 2/5" — which day of the trip today is, 1-based.
 *
 * Null outside the trip, so a caller can render the counter without first
 * repeating the phase check and getting "ngày 0" or "ngày 7/5" wrong.
 */
export function tripDay(
  startDate: string,
  endDate: string,
  today = todayKey(),
): { day: number; total: number } | null {
  const total = daysBetweenKeys(startDate, endDate) + 1;
  if (total < 1) return null;
  const day = daysBetweenKeys(startDate, today) + 1;
  if (day < 1 || day > total) return null;
  return { day, total };
}

