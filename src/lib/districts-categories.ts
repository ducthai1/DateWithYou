// Shared enums for locations — used by the UI filters and the Zod schemas.

export const DISTRICTS = [
  "Quận 1",
  "Quận 3",
  "Quận 4",
  "Quận 5",
  "Quận 7",
  "Quận 10",
  "Bình Thạnh",
  "Phú Nhuận",
  "Gò Vấp",
  "Tân Bình",
  "Thủ Đức",
  "Khác",
] as const;

export const CATEGORIES = [
  "Cà phê",
  "Ăn tối",
  "Street food",
  "Workshop",
  "Chụp ảnh",
  "Khác",
] as const;

export type District = (typeof DISTRICTS)[number];
export type Category = (typeof CATEGORIES)[number];

export type LocationStatus = "want_to_go" | "visited";
