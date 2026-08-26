import type { Metadata } from "next";
import { FeaturePageShell } from "@/components/marketing/feature-page-shell";
import {
  buildFeaturePageMetadata,
  FeaturePageStructuredData,
} from "@/components/marketing/feature-page-seo";
import { NHAT_KY_DU_LICH } from "@/components/marketing/feature-pages/nhat-ky-du-lich";

/*
 * Thin on purpose. The copy lives in the content file and the layout lives in
 * the shell, so this route only wires the two together and emits the metadata
 * and structured data that a Server Component is required for.
 */
export const metadata: Metadata = buildFeaturePageMetadata(NHAT_KY_DU_LICH);

export default function Page() {
  return (
    <>
      <FeaturePageStructuredData page={NHAT_KY_DU_LICH} />
      <FeaturePageShell page={NHAT_KY_DU_LICH} />
    </>
  );
}
