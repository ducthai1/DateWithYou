import type { Metadata } from "next";
import { ReleaseList } from "@/features/admin/release-list";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = { title: "Nhật ký phát hành", robots: { index: false, follow: false } };

export default function ChangelogPage() {
  return (
    <PageShell header={<h1 className="text-h1 font-semibold">Nhật ký phát hành</h1>}>
      <ReleaseList />
    </PageShell>
  );
}
