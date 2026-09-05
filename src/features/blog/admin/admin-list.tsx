"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/components/ui/toast";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { CATEGORY_LABEL } from "@/features/blog/post-card";
import { Pencil, Plus, Trash2, ExternalLink, Loader2, Eye, Clock, Tags } from "lucide-react";
import { CategoryManager } from "@/features/blog/admin/category-manager";

/**
 * The admin post list, and the gate for the whole admin section.
 *
 * There is no server env leaked to the client to decide who is an admin: the
 * page simply calls adminList, and the answer the router gives is the
 * authorisation. UNAUTHORIZED means sign in; FORBIDDEN means this account is
 * not on the allowlist.
 */
export function BlogAdminList() {
  const toast = useToast();
  const utils = trpc.useUtils();
  const list = trpc.blog.adminList.useQuery(undefined, { retry: false });
  const cats = trpc.blog.categories.useQuery().data ?? [];
  const labelOf = (slug: string) => cats.find((c) => c.slug === slug)?.name ?? CATEGORY_LABEL[slug] ?? slug;
  const remove = trpc.blog.remove.useMutation({
    onSuccess: () => {
      utils.blog.adminList.invalidate();
      toast("Đã xoá bài", "success");
    },
    onError: () => toast("Không xoá được", "error"),
  });

  if (list.isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 p-10">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
      </div>
    );
  }

  if (list.error) {
    const code = list.error.data?.code;
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        {code === "UNAUTHORIZED" ? (
          <>
            <p className="text-foreground font-medium">Cần đăng nhập</p>
            <Link href="/sign-in?next=/admin/blog" className="text-accent mt-2 inline-block hover:underline">
              Đăng nhập
            </Link>
          </>
        ) : (
          <div className="text-muted-foreground space-y-2 text-sm">
            <p className="text-foreground font-medium">Chưa có quyền quản trị blog</p>
            <p className="text-xs leading-relaxed">
              Kiểm tra: email bạn đang đăng nhập có nằm <strong>y hệt</strong> trong biến{" "}
              <code>ADMIN_EMAILS</code> không (đúng ký tự, phân cách bằng dấu phẩy). Nếu vừa đặt trên
              Vercel, cần <strong>Redeploy</strong> thì biến mới có hiệu lực.
            </p>
          </div>
        )}
      </div>
    );
  }

  const posts = list.data ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="border-border bg-card rounded-3xl border p-5 shadow-sm sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">Quản lý blog</h1>
          <p className="text-muted-foreground text-sm">{posts.length} bài</p>
        </div>
        <Link href="/admin/blog/new" className="bg-accent inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white">
          <Plus className="h-4 w-4" /> Viết bài
        </Link>
      </div>

      <details className="border-border mb-4 rounded-2xl border p-3 text-sm">
        <summary className="text-muted-foreground flex cursor-pointer items-center gap-1.5 font-medium">
          <Tags className="h-4 w-4" /> Quản lý danh mục
        </summary>
        <div className="mt-3">
          <CategoryManager />
        </div>
      </details>

      {posts.length === 0 ? (
        <p className="text-muted-foreground rounded-2xl border border-dashed border-border p-10 text-center">
          Chưa có bài nào. Bấm “Viết bài” để bắt đầu.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {posts.map((p) => {
            const scheduled =
              p.status === "published" && !!p.publishedAt && new Date(p.publishedAt).getTime() > Date.now();
            const badge = scheduled
              ? { text: "Đã lên lịch", cls: "bg-amber-100 text-amber-700" }
              : p.status === "published"
                ? { text: "Đã đăng", cls: "bg-emerald-100 text-emerald-700" }
                : { text: "Nháp", cls: "bg-muted text-muted-foreground" };
            return (
            <li key={p.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>
                    {badge.text}
                  </span>
                  {p.featured && <span className="text-accent text-[11px] font-semibold">★ Nổi bật</span>}
                  <span className="text-muted-foreground text-xs">{labelOf(p.category)}</span>
                </div>
                <p className="text-foreground mt-0.5 truncate font-medium">{p.title}</p>
                <p className="text-muted-foreground truncate text-xs">
                  /blog/{p.slug} · {p.viewCount} lượt xem
                  {scheduled && p.publishedAt && (
                    <span className="ml-1 inline-flex items-center gap-1 text-amber-700">
                      <Clock className="h-3 w-3" /> {new Date(p.publishedAt).toLocaleString("vi-VN")}
                    </span>
                  )}
                </p>
              </div>
              {p.status === "published" && (
                <Link href={`/blog/${p.slug}`} target="_blank" aria-label="Xem bài" title="Xem" className="text-muted-foreground hover:bg-muted flex h-9 w-9 items-center justify-center rounded-lg">
                  <ExternalLink className="h-4 w-4" />
                </Link>
              )}
              <Link href={`/admin/blog/${p.id}/preview`} target="_blank" aria-label="Xem trước" title="Xem trước" className="text-muted-foreground hover:bg-muted flex h-9 w-9 items-center justify-center rounded-lg">
                <Eye className="h-4 w-4" />
              </Link>
              <Link href={`/admin/blog/${p.id}`} aria-label="Sửa" title="Sửa" className="text-muted-foreground hover:bg-muted flex h-9 w-9 items-center justify-center rounded-lg">
                <Pencil className="h-4 w-4" />
              </Link>
              <ConfirmButton
                idle=""
                icon={<Trash2 className="h-4 w-4" />}
                aria-label="Xoá bài"
                title="Xoá bài này?"
                description={`"${p.title}" sẽ bị xoá vĩnh viễn.`}
                disabled={remove.isPending}
                className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive flex h-9 w-9 items-center justify-center rounded-lg"
                onConfirm={() => remove.mutate({ id: p.id })}
              />
            </li>
            );
          })}
        </ul>
      )}
      </div>
    </div>
  );
}
