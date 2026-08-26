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
export const metadata: Metadata = buildFeaturePageMetadata(THU_GUI_TUONG_LAI);

export default function Page() {
  return (
    <>
      <FeaturePageStructuredData page={THU_GUI_TUONG_LAI} />
      <FeaturePageShell page={THU_GUI_TUONG_LAI} />
    </>
  );
}
