/**
 * The emotion buttons shown while riding.
 *
 * Shared by the buttons and by the server, which turns a tap into a
 * notification for a partner whose phone is in a pocket — the in-app banner
 * only reaches a screen that is on.
 */
export const PING_BUTTONS: Array<{ action: string; emoji: string; label: string; urgent?: boolean }> = [
  { action: "HOT", emoji: "🥵", label: "Nóng quá!" },
  { action: "JAM", emoji: "🐌", label: "Kẹt xe!" },
  { action: "WAIT", emoji: "🥺", label: "Đợi xíu nha" },
  { action: "HURRY", emoji: "🚨", label: "Nhanh lên!", urgent: true },
];

export const pingButton = (action: string) => PING_BUTTONS.find((b) => b.action === action) ?? null;
