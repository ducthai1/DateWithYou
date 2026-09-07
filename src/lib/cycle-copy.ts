import type { Gender } from "@/lib/gender";

/**
 * Every word this feature says out loud, in one place.
 *
 * Two people share one calendar and one set of notifications, so each side has
 * to be written FOR THE READER: he is nudged to look after her, she is nudged
 * to look after herself. The same sentence sent to both would be wrong for one
 * of them — that is the whole reason the app asks who is reading.
 *
 * Nothing here names the thing clinically on a surface both people glance at.
 * The calendar keeps a soft phrase; the plainer word only appears in a
 * notification, which lands on one person's own phone.
 *
 * A null gender means the question has not been answered yet. That falls back
 * to neutral wording rather than assuming — the app would rather say something
 * slightly general than address someone as the wrong person.
 */

/** The label shown on the calendar day itself. Deliberately not clinical. */
export function cycleDayLabel(viewer: Gender | null): string {
  if (viewer === "male") return "Những ngày cần được yêu thương hơn 💛";
  if (viewer === "female") return "Những ngày cần được nghỉ ngơi 🌸";
  return "Những ngày cần được nhẹ nhàng 🌸";
}

/** Short form for a tight space (a calendar cell tooltip, a chip). */
export function cycleDayShortLabel(viewer: Gender | null): string {
  return viewer === "female" ? "Ngày nghỉ ngơi 🌸" : "Ngày yêu thương 💛";
}

/**
 * The line under the label on a day view, which says out loud that this is a
 * likelihood and not an appointment.
 *
 * Shared by the mobile day card and the desktop day modal. It lived in only one
 * of them at first, so a desktop visitor clicking the day the ribbon called
 * "Dự kiến" got no explanation at all — found by opening the modal in a
 * screenshot rather than by reasoning about the code.
 */
export function cycleDayNote(isPeak: boolean): string {
  return isPeak
    ? "Ngày dễ xảy ra nhất trong khoảng dự kiến — không phải chắc chắn."
    : "Nằm trong khoảng dự kiến, có thể sớm hoặc muộn hơn một chút.";
}

export type CycleReminder = { title: string; body: string };

/**
 * The push copy.
 *
 * `daysAhead` is 2 for the heads-up and 0 for the day itself — the two moments
 * the couple chose. `dateLabel` is already human ("12/10"), because formatting
 * a date is the caller's job and this file only writes sentences.
 */
export function cycleReminderCopy(
  viewer: Gender | null,
  daysAhead: number,
  dateLabel: string,
): CycleReminder {
  if (viewer === "female") {
    return daysAhead > 0
      ? {
          title: "Sắp tới ngày của em 🌸",
          body: `Khoảng ${dateLabel}. Nhớ giữ ấm, ăn uống nhẹ nhàng và ngủ sớm hơn một chút nhé.`,
        }
      : {
          title: "Hôm nay nhẹ nhàng với mình nhé 🌸",
          body: "Thấy mệt thì cứ nghỉ, không cần cố hôm nay. Uống nước ấm nha.",
        };
  }
  if (viewer === "male") {
    return daysAhead > 0
      ? {
          title: "Nhắc nhẹ trước hai ngày 💛",
          body: `Khoảng ${dateLabel} là kỳ của nàng. Chuẩn bị nước ấm, chút đồ ngọt, và kiên nhẫn hơn một chút nha.`,
        }
      : {
          title: "Hôm nay dịu dàng hơn nhé 💛",
          body: "Nàng có thể mệt trong người. Một ly nước ấm và một cái ôm là đủ.",
        };
  }
  return daysAhead > 0
    ? {
        title: "Nhắc nhẹ trước hai ngày 🌸",
        body: `Khoảng ${dateLabel} là những ngày cần nhẹ nhàng hơn.`,
      }
    : {
        title: "Hôm nay nhẹ nhàng hơn nhé 🌸",
        body: "Giữ ấm, nghỉ ngơi, và đừng cố quá.",
      };
}

/** `2026-10-12` → `12/10`, the way the reminder says it out loud. */
export function shortDateLabel(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${Number(day)}/${Number(month)}`;
}
