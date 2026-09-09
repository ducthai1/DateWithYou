import type { Metadata } from "next";
import { FeaturePageShell } from "@/components/marketing/feature-page-shell";
import {
  buildFeaturePageMetadata,
  FeaturePageStructuredData,
} from "@/components/marketing/feature-page-seo";
import { THU_GUI_TUONG_LAI } from "@/components/marketing/feature-pages/thu-gui-tuong-lai";

/*
 * Thin on purpose. The copy lives in the content file and the layout lives in
 * the shell, so this route only wires the two together and emits the metadata
 * and structured data that a Server Component is required for.
 */
/*
 * Served from the CDN, not rendered per request.
 *
 * Without this the page is dynamic — the root layout reads the tone cookie,
 * which makes every route dynamic by default — so each visit and each crawl
 * paid for a server render of a page whose content is a constant. That is the
 * same trap the blog fell into, and the same one line fixes it. The cost is
 * that a returning visitor's saved tone is not in the first HTML; ToneProvider
 * applies it on the client, and a first-time visitor from a search result has
 * no tone cookie to honour anyway.
 */
export const dynamic = "force-static";

export const metadata: Metadata = buildFeaturePageMetadata(THU_GUI_TUONG_LAI);

export default function Page() {
  return (
    <>
      <FeaturePageStructuredData page={THU_GUI_TUONG_LAI} />
      <FeaturePageShell page={THU_GUI_TUONG_LAI} />
    </>
  );
}
