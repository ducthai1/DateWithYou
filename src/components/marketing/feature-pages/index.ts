import type { FeaturePage } from "./types";
import { FEATURE_PAGE_SLUGS, type FeaturePageSlug } from "./slugs";
import { HOM_NAY_AN_GI } from "./hom-nay-an-gi";
import { LUU_DIA_DIEM_DA_DI } from "./luu-dia-diem-da-di";
import { NHAT_KY_DU_LICH } from "./nhat-ky-du-lich";
import { THU_GUI_TUONG_LAI } from "./thu-gui-tuong-lai";

export type { FeaturePage, FeaturePageSection, RelatedLink } from "./types";
export { FEATURE_PAGE_SLUGS, type FeaturePageSlug } from "./slugs";

/** Content for each page, keyed by slug. */
const BY_SLUG: Record<FeaturePageSlug, FeaturePage> = {
  "hom-nay-an-gi": HOM_NAY_AN_GI,
  "luu-dia-diem-da-di": LUU_DIA_DIEM_DA_DI,
  "nhat-ky-du-lich": NHAT_KY_DU_LICH,
  "thu-gui-tuong-lai": THU_GUI_TUONG_LAI,
};

/**
 * The public feature pages, ordered by the slug list so the sitemap, the nav
 * exclusions and the landing links can never disagree about which pages exist.
 * A slug with no content above is a type error rather than a page that quietly
 * drops out of the sitemap.
 */
export const FEATURE_PAGES: FeaturePage[] = FEATURE_PAGE_SLUGS.map(
  (slug) => BY_SLUG[slug],
);

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
