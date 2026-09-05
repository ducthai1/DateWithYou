import type { Metadata } from "next";
import { BlogForm } from "@/features/blog/admin/blog-form";

export const metadata: Metadata = { title: "Viết bài mới", robots: { index: false, follow: false } };

export default function NewPostPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-foreground mb-6 text-2xl font-bold">Viết bài mới</h1>
      <BlogForm />
    </div>
  );
}
