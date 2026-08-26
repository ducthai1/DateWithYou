// Shared enums for locations — used by the UI filters and the Zod schemas.

/**
 * Default areas offered when a space is first created.
 *
 * These used to be Ho Chi Minh City's districts — "Quận 1", "Quận 3", and so
 * on. That tier of government no longer exists: from 1 July 2025 Vietnam
 * abolished the district level nationwide and moved to two tiers
 * (tỉnh/thành → phường/xã), and Bình Dương and Bà Rịa–Vũng Tàu were merged into
 * Ho Chi Minh City. Seeding new spaces with a list of abolished units meant
 * offering people a filter built on names their own address no longer uses.
 *
 * Two decisions worth stating, because neither is obvious:
 *
 * The replacement is not the full ward list. The reorganised city has around
 * 168 ward-level units; a dropdown of 168 entries is worse for choosing where
 * you saved a café than the twelve it replaces. This is a personal filter over
 * your own pins, not an address field, so the list stays short and the settings
 * modal lets each space edit it.
 *
 * Entries marked "(cũ)" are former districts whose new ward names could not be
 * verified from a source at the time of writing, and inventing administrative
 * names is not acceptable. They are kept, clearly labelled as the old naming,
 * so nobody's existing pins fall out of the filter — and so it is obvious which
 * rows still need replacing rather than looking finished.
 *
 * The field itself accepts any string (see districtSchema in the location
 * router), and this list only seeds a space on first access — an existing space
 * keeps whatever it already has. So editing this constant changes what new
 * spaces get, and nothing else.
 */
export const DISTRICTS = [
  // Verified new ward names for the former central districts.
  "Phường Sài Gòn",
  "Phường Bến Thành",
  "Phường Tân Định",
  "Phường Cầu Ông Lãnh",
  "Phường Bàn Cờ",
  "Phường Xuân Hòa",
  "Phường Nhiêu Lộc",
  "Phường Xóm Chiếu",
  "Phường Khánh Hội",
  "Phường Chợ Quán",
  "Phường An Đông",
  "Phường Chợ Lớn",
  // Former districts whose new ward names are not yet verified here.
  "Quận 7 (cũ)",
  "Quận 10 (cũ)",
  "Bình Thạnh (cũ)",
  "Phú Nhuận (cũ)",
  "Gò Vấp (cũ)",
  "Tân Bình (cũ)",
  "Thủ Đức (cũ)",
  // The areas that joined the city in the 2025 merger.
  "Bình Dương",
  "Vũng Tàu",
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
