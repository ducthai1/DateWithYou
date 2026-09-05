"use client";

import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { BlogForm, type BlogFormValues } from "./blog-form";

/** Loads a post by id (admin) and hands it to the form, or shows the gate. */
export function BlogEditLoader({ id }: { id: string }) {
  const q = trpc.blog.adminGet.useQuery({ id }, { retry: false });

  if (q.isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 p-10">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang tải bài…
      </div>
    );
  }
  if (q.error) {
    const forbidden = q.error.data?.code === "FORBIDDEN" || q.error.data?.code === "UNAUTHORIZED";
    return (
      <p className="text-muted-foreground p-10 text-center">
        {forbidden ? "Không có quyền chỉnh sửa." : "Không tìm thấy bài viết."}
      </p>
    );
  }

  const p = q.data;
  if (!p) return <p className="text-muted-foreground p-10 text-center">Không tìm thấy bài viết.</p>;
  const initial: BlogFormValues = {
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    body: p.body,
    coverImage: p.coverImage ?? "",
    category: p.category as BlogFormValues["category"],
    tags: p.tags,
    featured: p.featured,
    status: p.status,
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
    publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : undefined,
  };
  return <BlogForm initial={initial} />;
}
