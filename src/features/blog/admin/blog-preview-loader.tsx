"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Loader2, ArrowLeft } from "lucide-react";
import { ArticleView } from "@/features/blog/article-view";

/** The status pill shown above a preview: draft, scheduled (with its time), or live. */
function statusPill(status: string, publishedAt: string | Date | null) {
  if (status !== "published") return { text: "Bản nháp", cls: "bg-muted text-muted-foreground" };
  if (publishedAt && new Date(publishedAt).getTime() > Date.now()) {
    return {
      text: `Đã lên lịch · ${new Date(publishedAt).toLocaleString("vi-VN")}`,
      cls: "bg-amber-100 text-amber-700",
    };
  }
  return { text: "Đã đăng", cls: "bg-emerald-100 text-emerald-700" };
}

/**
 * Admin-only preview. It calls adminGet — the same allowlist gate as the rest of
 * the admin section — so an unpublished or scheduled post can be seen exactly as
 * it will render publicly, through the shared ArticleView.
 */
export function BlogPreviewLoader({ id }: { id: string }) {
  const q = trpc.blog.adminGet.useQuery({ id }, { retry: false });

  if (q.isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 p-10">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
      </div>
    );
  }
  if (q.error) {
    const forbidden = q.error.data?.code === "FORBIDDEN" || q.error.data?.code === "UNAUTHORIZED";
    return (
      <p className="text-muted-foreground p-10 text-center">
        {forbidden ? "Không có quyền xem." : "Không tìm thấy bài viết."}
      </p>
    );
  }
  const p = q.data;
  if (!p) return <p className="text-muted-foreground p-10 text-center">Không tìm thấy bài viết.</p>;
  const pill = statusPill(p.status, p.publishedAt);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={`/admin/blog/${p.id}`}
          className="text-muted-foreground hover:text-accent inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Quay lại sửa
        </Link>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pill.cls}`}>{pill.text}</span>
      </div>
      <p className="text-muted-foreground border-border mb-4 rounded-lg border border-dashed px-3 py-2 text-xs">
        Bản xem trước cho quản trị viên — hiển thị y như trang công khai sẽ trông thế này.
      </p>
      <ArticleView post={p} />
    </div>
  );
}
