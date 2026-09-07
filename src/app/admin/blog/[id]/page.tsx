import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BlogEditLoader } from "@/features/blog/admin/blog-edit-loader";

export const metadata: Metadata = { title: "Sửa bài", robots: { index: false, follow: false } };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-foreground text-2xl font-bold">Sửa bài</h1>
        <Link href="/admin/blog" className="text-muted-foreground hover:text-accent inline-flex items-center gap-1 text-sm">
          <ArrowLeft className="h-4 w-4" /> Danh sách bài
        </Link>
      </div>
      <BlogEditLoader id={id} />
    </div>
  );
}
