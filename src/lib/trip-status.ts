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
 * Trips saved before this existed carry "upcoming", which meant "not started
 * yet" — the same thing "planning" means now. Read-time normalisation rather
 * than a migration: nothing is rewritten until the couple next saves the trip,
 * and an old row is never left showing a status the UI has no word for.
 */
export function normaliseTripStatus(raw: unknown): TripStatus {
  if (raw === "active" || raw === "completed") return raw;
  return "planning";
}

export const TRIP_STATUS_META: Record<
  TripStatus,
  { full: string; short: string; pill: string; hint: string }
> = {
  planning: {
    full: "Đang chuẩn bị",
    // The segmented control sits inside a card that is 360px wide on a phone;
    // three full labels do not fit, and a wrapped chip reads as broken.
    short: "Chuẩn bị",
    pill: "ĐANG CHUẨN BỊ",
    hint: "Còn đang lên lịch trình, gom đồ, chốt chỗ ở.",
  },
  active: {
    full: "Đang trong hành trình",
    short: "Đang đi",
    pill: "ĐANG ĐI",
    hint: "Hai đứa đang trên đường — lịch trình hôm nay hiện ở trang chủ.",
  },
  completed: {
    full: "Đã đi rồi",
    short: "Đã đi",
    pill: "ĐÃ ĐI",
    hint: "Chuyến đã khép lại, giờ nằm trong kho kỷ niệm.",
  },
};

export type TripPhase = "before" | "during" | "after";

/** Where today sits relative to the trip's own dates. Pure calendar comparison. */
export function tripPhase(startDate: string, endDate: string, today = todayKey()): TripPhase {
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

/** Days left until departure. Only meaningful before the trip starts. */
export function daysUntilTrip(startDate: string, today = todayKey()): number {
  return daysBetweenKeys(today, startDate);
}

export type TripNudge = { to: TripStatus; label: string; cta: string };

/**
 * What the dates say that the stored status does not.
 *
 * The app noticing is the whole point; the app *deciding* is not. This returns
 * an offer the couple can take with one tap or ignore forever — a trip put off
 * by a week must not silently mark itself as under way. The wording asks,
 * it does not instruct: this is a travel diary, not a supervisor.
 */
export function tripNudge(
  status: TripStatus,
  startDate: string,
  endDate: string,
  today = todayKey(),
): TripNudge | null {
  const phase = tripPhase(startDate, endDate, today);
  if (phase === "during" && status === "planning") {
    const d = tripDay(startDate, endDate, today);
    return {
      to: "active",
      label:
        d && d.day === 1 ? "Hôm nay là ngày khởi hành rồi đó" : `Chuyến này đang trong ngày ${d?.day}`,
      cta: "Bắt đầu hành trình",
    };
  }
  if (phase === "after" && status !== "completed") {
    return { to: "completed", label: "Chuyến đã qua ngày cuối", cta: "Khép lại chuyến" };
  }
  if (phase === "before" && status === "active") {
    return { to: "planning", label: "Chuyến chưa tới ngày đi", cta: "Về đang chuẩn bị" };
  }
  return null;
}
