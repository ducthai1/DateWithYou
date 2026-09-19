import type { Metadata } from "next";
import { ReleaseDetail } from "@/features/admin/release-list";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = { title: "Chi tiết đợt phát hành", robots: { index: false, follow: false } };

export default async function ReleasePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return (
    <PageShell>
      <ReleaseDetail date={date} />
    </PageShell>
  );
}
