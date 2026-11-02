import { foldForSearch } from "@/lib/vietnamese-text";

/**
 * Starting points for "Phiếu bé ngoan", so the first task is a tap instead of
 * a blank box and a number pulled from the air.
 *
 * Points follow the panel's own defaults — a small task 10, a voucher 50 — so
 * an idea never sets a scale the couple did not choose: the quick chores sit
 * at 5–10, the evening-long ones at 20; a small treat costs a few tasks, a
 * planned date a week of them.
 */

export type RewardIdea = { title: string; points: number };

export const TASK_IDEAS: RewardIdea[] = [
  { title: "Rửa bát", points: 10 },
  { title: "Nấu bữa tối", points: 20 },
  { title: "Đấm lưng 15 phút", points: 10 },
  { title: "Dọn nhà", points: 20 },
  { title: "Đi chợ", points: 15 },
  { title: "Giặt và phơi đồ", points: 10 },
  { title: "Pha cà phê buổi sáng", points: 5 },
  { title: "Massage chân 15 phút", points: 15 },
  { title: "Đưa đón đi làm", points: 15 },
  { title: "Đổ rác", points: 5 },
];

export const VOUCHER_IDEAS: RewardIdea[] = [
  { title: "Được chọn phim tối nay", points: 30 },
  { title: "Chọn món ăn cuối tuần", points: 30 },
  { title: "Được miễn đi chợ một lần", points: 40 },
  { title: "Một ngày không phải rửa bát", points: 50 },
  { title: "Được ngủ nướng cuối tuần", points: 50 },
  { title: "Massage 30 phút", points: 80 },
  { title: "Một buổi hẹn do mình lên kế hoạch", points: 100 },
  { title: "Một món quà nhỏ bất ngờ", points: 150 },
];

export const TASK_POINT_PRESETS = [5, 10, 20, 50];
export const VOUCHER_POINT_PRESETS = [30, 50, 100, 200];

/** The ideas not already on the list — compared without accents, case or extra spaces. */
export function freshIdeas(ideas: RewardIdea[], taken: string[]): RewardIdea[] {
  const have = new Set(taken.map(foldForSearch));
  return ideas.filter((i) => !have.has(foldForSearch(i.title)));
}
