import { NOTEBOOK_LIMITS } from "@/lib/notebook";

/**
 * Starting shapes for a new notebook, so "Sổ mới" is a tap rather than a list
 * of columns typed out with commas.
 *
 * Each one is what this kind of notebook was set up with by hand before: the
 * meal plan that started the feature ("Trưa 12h, Bữa phụ 17h30, Tối 19h30,
 * Tập"), and the plain three-meals and study shapes. The columns box stays
 * editable — a template is a start, not a choice made for anyone.
 */

export type NotebookTemplate = { name: string; title: string; slots: string[]; days: number };

export const NOTEBOOK_TEMPLATES: NotebookTemplate[] = [
  { name: "Thực đơn", title: "Thực đơn", slots: ["Sáng", "Trưa", "Tối"], days: 14 },
  { name: "Siết cân", title: "Siết cân", slots: ["Trưa 12h", "Bữa phụ 17h30", "Tối 19h30", "Tập"], days: 30 },
  { name: "Lịch tập", title: "Lịch tập", slots: ["Khởi động", "Bài chính", "Giãn cơ"], days: 28 },
  { name: "Ôn thi", title: "Ôn thi", slots: ["Sáng", "Chiều", "Tối"], days: 30 },
];

export const NOTEBOOK_SPANS = [
  { label: "1 tuần", days: 7 },
  { label: "2 tuần", days: 14 },
  { label: "1 tháng", days: 30 },
] as const;

/** Every template fits what the server accepts — checked by test, so a new one cannot quietly break "Tạo sổ". */
export function templateFits(t: NotebookTemplate): boolean {
  return (
    t.title.length <= NOTEBOOK_LIMITS.title &&
    t.slots.length > 0 &&
    t.slots.length <= NOTEBOOK_LIMITS.slots &&
    t.slots.every((s) => s.length > 0 && s.length <= NOTEBOOK_LIMITS.slotLabel && !s.includes(",")) &&
    t.days > 0 &&
    t.days <= NOTEBOOK_LIMITS.days
  );
}
