import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BlogForm } from "@/features/blog/admin/blog-form";

export const metadata: Metadata = { title: "Viết bài mới", robots: { index: false, follow: false } };

export default function NewPostPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-foreground text-2xl font-bold">Viết bài mới</h1>
        <Link href="/admin/blog" className="text-muted-foreground hover:text-accent inline-flex items-center gap-1 text-sm">
          <ArrowLeft className="h-4 w-4" /> Danh sách bài
        </Link>
      </div>
      <BlogForm />
    </div>
  );
}
