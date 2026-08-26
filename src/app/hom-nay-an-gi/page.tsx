import type { Metadata } from "next";
import { FeaturePageShell } from "@/components/marketing/feature-page-shell";
import {
  buildFeaturePageMetadata,
  FeaturePageStructuredData,
} from "@/components/marketing/feature-page-seo";
import { HOM_NAY_AN_GI } from "@/components/marketing/feature-pages/hom-nay-an-gi";

/*
 * Thin on purpose. The copy lives in the content file and the layout lives in
 * the shell, so this route only wires the two together and emits the metadata
 * and structured data that a Server Component is required for.
 */
export const metadata: Metadata = buildFeaturePageMetadata(HOM_NAY_AN_GI);

export default function Page() {
  return (
    <>
      <FeaturePageStructuredData page={HOM_NAY_AN_GI} />
      <FeaturePageShell page={HOM_NAY_AN_GI} />
    </>
  );
}
