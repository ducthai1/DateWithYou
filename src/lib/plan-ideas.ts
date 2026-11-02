import { foldForSearch } from "@/lib/vietnamese-text";

/**
 * What the "Thêm dự định" form offers so nobody has to think up a plan, or a
 * name for its kind, from a blank box.
 *
 * The form used to be three empty fields; the category was free text, so the
 * same kind of plan came out as "Du lịch", "du lich" and "Đi chơi xa" and the
 * badge on the card stopped meaning anything. Now the kinds are a short fixed
 * list (anything already typed before still shows, and "Khác" still takes a
 * new one), the kind is guessed from the title, and the title itself can come
 * from a tap: a place they saved as "Muốn đi", or one of the ideas below.
 */

export const PLAN_CATEGORIES = [
  "Du lịch",
  "Ăn uống",
  "Trải nghiệm",
  "Mua sắm",
  "Học cùng nhau",
  "Tổ ấm",
] as const;

export type PlanCategory = (typeof PLAN_CATEGORIES)[number];

export type PlanIdea = { title: string; category: PlanCategory };

/** Things couples put on a list "for one day". Ordered so the first six already cover every kind. */
export const PLAN_IDEAS: PlanIdea[] = [
  { title: "Đi Đà Lạt", category: "Du lịch" },
  { title: "Ăn buffet hải sản", category: "Ăn uống" },
  { title: "Đi xem concert", category: "Trải nghiệm" },
  { title: "Mua đồ đôi", category: "Mua sắm" },
  { title: "Học nhảy đôi", category: "Học cùng nhau" },
  { title: "Nuôi một bé mèo", category: "Tổ ấm" },
  { title: "Cắm trại qua đêm", category: "Du lịch" },
  { title: "Học làm gốm", category: "Học cùng nhau" },
  { title: "Tự nấu một bữa tối thịnh soạn", category: "Ăn uống" },
  { title: "Chụp bộ ảnh đôi", category: "Trải nghiệm" },
  { title: "Ngắm bình minh trên biển", category: "Du lịch" },
  { title: "Trồng một chậu cây chung", category: "Tổ ấm" },
  { title: "Đi food tour phố cổ", category: "Ăn uống" },
  { title: "Học bơi", category: "Học cùng nhau" },
  { title: "Đi Phú Quốc", category: "Du lịch" },
  { title: "Xem pháo hoa giao thừa", category: "Trải nghiệm" },
  { title: "Sắm vali mới", category: "Mua sắm" },
  { title: "Trang trí lại phòng", category: "Tổ ấm" },
  { title: "Đi Hà Giang mùa hoa", category: "Du lịch" },
  { title: "Thử một quán Michelin", category: "Ăn uống" },
  { title: "Đi công viên giải trí", category: "Trải nghiệm" },
  { title: "Học một ngoại ngữ", category: "Học cùng nhau" },
  { title: "Đi nước ngoài cùng nhau", category: "Du lịch" },
  { title: "Tiết kiệm mua nhà", category: "Tổ ấm" },
  { title: "Làm một album ảnh in", category: "Trải nghiệm" },
  { title: "Học nấu món Hàn", category: "Học cùng nhau" },
];

/*
 * Guessing the kind from the title.
 *
 * Matched on folded text with spaces as the word edges — JS's `\b` only knows
 * ASCII letters, and folding first is what makes the words ASCII. Order is the
 * rule, and travel is tried twice for that reason:
 * - "Mua nhà" is home, not shopping, so home comes before "mua".
 * - A named destination wins over food, because "Hội An" folds to "hoi an" and
 *   would otherwise read as "ăn"; "Nha Trang" is listed whole so it never
 *   reads as "nhà" either.
 * - A bare "đi" only means travel when nothing else matched: "Đi ăn buffet" is
 *   food, "Đi xem concert" is an outing.
 * - "Nhật" is only Japan after "đi" or before "Bản" — alone it is "sinh nhật".
 */
const GUESS_RULES: Array<[PlanCategory, string[]]> = [
  ["Tổ ấm", ["mua nha", "can ho", "nuoi", "trong cay", "chau cay", "cay canh", "trang tri", "don nha", "sua nha", "dam cuoi", "cuoi nhau", "sinh con", "tiet kiem"]],
  ["Học cùng nhau", ["hoc", "khoa hoc", "lop"]],
  ["Du lịch", ["du lich", "phuot", "cam trai", "bien", "dao", "da lat", "phu quoc", "nha trang", "ha giang", "sapa", "sa pa", "hoi an", "da nang", "vung tau", "ha noi", "hue", "nuoc ngoai", "di nhat", "nhat ban", "han quoc", "thai lan", "singapore", "chau au", "trekking", "resort", "homestay"]],
  ["Ăn uống", ["an", "quan", "nha hang", "buffet", "lau", "nuong", "ca phe", "cafe", "coffee", "tra sua", "nau", "mon", "food", "michelin", "banh"]],
  ["Mua sắm", ["mua", "sam", "shopping", "order"]],
  ["Trải nghiệm", ["xem", "concert", "phim", "workshop", "chup", "phao hoa", "cong vien", "ve tranh", "album", "spa", "kich", "sinh nhat"]],
  ["Du lịch", ["di", "nui"]],
];

export function guessPlanCategory(title: string): PlanCategory | null {
  const text = ` ${foldForSearch(title)} `;
  if (text.trim() === "") return null;
  for (const [category, words] of GUESS_RULES) {
    if (words.some((w) => text.includes(` ${w} `))) return category;
  }
  return null;
}

/** Same title, whatever its accents, spacing or case — so an idea already on the board is not offered again. */
export const sameTitle = (a: string, b: string) => foldForSearch(a) === foldForSearch(b);

/**
 * The ideas to show: not on the board already, of the chosen kind if there is
 * one, matching what has been typed if anything has. `turn` rotates through
 * the rest for the "Ý khác" button without ever repeating within a page.
 */
export function pickIdeas({
  taken,
  category,
  typed,
  turn = 0,
  count = 6,
}: {
  taken: string[];
  category?: string | null;
  typed?: string;
  turn?: number;
  count?: number;
}): PlanIdea[] {
  const q = foldForSearch(typed ?? "");
  const open = PLAN_IDEAS.filter(
    (i) =>
      !taken.some((t) => sameTitle(t, i.title)) &&
      (!category || i.category === category) &&
      (!q || foldForSearch(i.title).includes(q)),
  );
  if (open.length <= count) return open;
  const start = (turn * count) % open.length;
  return [...open.slice(start), ...open.slice(0, start)].slice(0, count);
}

/** A saved place's own category, translated into the kind of plan going there is. */
const PLACE_KIND: Record<string, PlanCategory> = {
  "Cà phê": "Ăn uống",
  "Ăn tối": "Ăn uống",
  "Street food": "Ăn uống",
  Workshop: "Trải nghiệm",
  "Chụp ảnh": "Trải nghiệm",
};

export type PlaceForPlan = {
  name: string;
  category: string;
  district?: string | null;
  mustTry?: string | null;
};

/** A place saved as "Muốn đi", ready to drop into the form. */
export function planFromPlace(place: PlaceForPlan): { title: string; category: PlanCategory; description: string } {
  const where = place.district ? `Ở ${place.district}.` : "";
  const dish = place.mustTry ? `Món nên thử: ${place.mustTry}.` : "";
  return {
    title: place.name,
    category: PLACE_KIND[place.category] ?? guessPlanCategory(`${place.category} ${place.name}`) ?? "Trải nghiệm",
    description: [where, dish].filter(Boolean).join(" "),
  };
}
