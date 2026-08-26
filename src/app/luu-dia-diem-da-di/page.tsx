import type { Metadata } from "next";
import { FeaturePageShell } from "@/components/marketing/feature-page-shell";
import {
  buildFeaturePageMetadata,
  FeaturePageStructuredData,
} from "@/components/marketing/feature-page-seo";
import { LUU_DIA_DIEM_DA_DI } from "@/components/marketing/feature-pages/luu-dia-diem-da-di";

/*
 * Thin on purpose. The copy lives in the content file and the layout lives in
 * the shell, so this route only wires the two together and emits the metadata
 * and structured data that a Server Component is required for.
 */
export const metadata: Metadata = buildFeaturePageMetadata(LUU_DIA_DIEM_DA_DI);

export default function Page() {
  return (
    <>
      <FeaturePageStructuredData page={LUU_DIA_DIEM_DA_DI} />
      <FeaturePageShell page={LUU_DIA_DIEM_DA_DI} />
    </>
  );
}
