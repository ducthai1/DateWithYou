import type { Metadata } from "next";
import { BlogEditLoader } from "@/features/blog/admin/blog-edit-loader";

export const metadata: Metadata = { title: "Sửa bài", robots: { index: false, follow: false } };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-foreground mb-6 text-2xl font-bold">Sửa bài</h1>
      <BlogEditLoader id={id} />
    </div>
  );
}
