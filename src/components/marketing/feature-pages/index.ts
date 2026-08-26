import type { FeaturePage } from "./types";
import { HOM_NAY_AN_GI } from "./hom-nay-an-gi";
import { LUU_DIA_DIEM_DA_DI } from "./luu-dia-diem-da-di";
import { NHAT_KY_DU_LICH } from "./nhat-ky-du-lich";
import { THU_GUI_TUONG_LAI } from "./thu-gui-tuong-lai";

export type { FeaturePage, FeaturePageSection, RelatedLink } from "./types";

/**
 * Registry of the public feature pages, in the order the landing page links to
 * them. Kept as one list so the sitemap cannot drift out of sync with what
 * actually exists — a page that is not in this array is not in the sitemap and
 * is not linked from anywhere, which is the same as not existing.
 */
export const FEATURE_PAGES: FeaturePage[] = [
  HOM_NAY_AN_GI,
  LUU_DIA_DIEM_DA_DI,
  NHAT_KY_DU_LICH,
  THU_GUI_TUONG_LAI,
];

/**
 * Where the page's secondary button goes — the actual screen in the app.
 *
 * Deliberately separate from the content files: which route serves a feature is
 * a routing fact that can change without a word of the copy changing. These are
 * all auth-gated, so a visitor who is not signed in lands on the sign-in screen
 * — which is why the primary button on every page is sign-up, not this.
 */
export const FEATURE_PAGE_APP_HREF: Record<string, string> = {
  "hom-nay-an-gi": "/wheel",
  "luu-dia-diem-da-di": "/map",
  "nhat-ky-du-lich": "/trips",
  "thu-gui-tuong-lai": "/vault",
};

/**
 * Per-page share image.
 *
 * All four point at the shared card for now. Once the dedicated artwork exists
 * these become one-line changes; pointing them at files that are not there yet
 * would ship four pages whose link previews are broken, which is worse than
 * four pages that share one correct preview.
 */
export const FEATURE_PAGE_OG_IMAGE: Record<string, string> = {
  "hom-nay-an-gi": "/og-card.jpg",
  "luu-dia-diem-da-di": "/og-card.jpg",
  "nhat-ky-du-lich": "/og-card.jpg",
  "thu-gui-tuong-lai": "/og-card.jpg",
};
