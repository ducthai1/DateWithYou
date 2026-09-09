import type { Metadata } from "next";
import { FeaturePageShell } from "@/components/marketing/feature-page-shell";
import {
  buildFeaturePageMetadata,
  FeaturePageStructuredData,
} from "@/components/marketing/feature-page-seo";
import { KHONG_BIET_DI_DAU } from "@/components/marketing/feature-pages/khong-biet-di-dau";

/*
 * Thin on purpose, like its siblings: the copy lives in the content file and
 * the layout in the shell, so this route only wires the two together and emits
 * the metadata and structured data a Server Component is required for.
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

export const metadata: Metadata = buildFeaturePageMetadata(KHONG_BIET_DI_DAU);

export default function Page() {
  return (
    <>
      <FeaturePageStructuredData page={KHONG_BIET_DI_DAU} />
      <FeaturePageShell page={KHONG_BIET_DI_DAU} />
    </>
  );
}
