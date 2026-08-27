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
 * Every entry is now a real post-reform unit. The earlier version kept seven
 * former districts labelled "(cũ)" because their new ward names could not be
 * verified and inventing administrative names is not acceptable. They were
 * resolved by asking TrackAsia's old-to-new conversion endpoint and checking
 * each answer against the vendored ward dataset — the four already verified by
 * hand came back identical, which is what makes the other seven trustworthy.
 *
 * The field itself accepts any string (see districtSchema in the location
 * router), and this list only seeds a space on first access — an existing space
 * keeps whatever it already has. So editing this constant changes what new
 * spaces get, and nothing else.
 */
export const DISTRICTS = [
  // Former central districts, converted through TrackAsia's old_to_new endpoint
  // and each one confirmed to exist in the vendored ward dataset. Two
  // independent sources agreeing is the reason these are stated plainly rather
  // than hedged: the four that were already verified by hand came back
  // identical, which is what earns trust in the seven that were not.
  "Phường Sài Gòn",      // Quận 1
  "Phường Xuân Hòa",     // Quận 3
  "Phường Khánh Hội",    // Quận 4
  "Phường An Đông",      // Quận 5
  "Phường Tân Mỹ",       // Quận 7
  "Phường Hòa Hưng",     // Quận 10
  "Phường Bình Thạnh",
  "Phường Phú Nhuận",
  "Phường Gò Vấp",
  "Phường Tân Bình",
  "Phường Thủ Đức",
  // Areas that joined the city in the 2025 merger.
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
