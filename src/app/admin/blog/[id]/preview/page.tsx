import type { Metadata } from "next";
import { BlogPreviewLoader } from "@/features/blog/admin/blog-preview-loader";

export const metadata: Metadata = { title: "Xem trước bài", robots: { index: false, follow: false } };

export default async function PreviewPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BlogPreviewLoader id={id} />;
}
