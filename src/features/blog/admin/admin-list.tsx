"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { cldThumb } from "@/lib/cloudinary-url";
import { useToast } from "@/components/ui/toast";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { CATEGORY_LABEL } from "@/features/blog/post-card";
import { Pencil, Plus, Trash2, ExternalLink, Loader2, Eye, Clock, Tags, Newspaper, Star } from "lucide-react";
import { CategoryManager } from "@/features/blog/admin/category-manager";

type Filter = "all" | "published" | "scheduled" | "draft";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "Tất cả" },
  { key: "published", label: "Đã đăng" },
  { key: "scheduled", label: "Lên lịch" },
  { key: "draft", label: "Nháp" },
];

function stateOf(p: { status: string; publishedAt: Date | string | null }): Exclude<Filter, "all"> {
  if (p.status !== "published") return "draft";
  if (p.publishedAt && new Date(p.publishedAt).getTime() > Date.now()) return "scheduled";
  return "published";
}

const BADGE: Record<Exclude<Filter, "all">, { text: string; cls: string }> = {
  published: { text: "Đã đăng", cls: "bg-emerald-100 text-emerald-700" },
  scheduled: { text: "Đã lên lịch", cls: "bg-amber-100 text-amber-700" },
  draft: { text: "Nháp", cls: "bg-muted text-muted-foreground" },
};

function viDate(d: Date | string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * The admin post list, and the gate for the whole admin section.
 *
 * There is no server env leaked to the client to decide who is an admin: the
 * page simply calls adminList, and the answer the router gives is the
 * authorisation. UNAUTHORIZED means sign in; FORBIDDEN means this account is
 * not on the allowlist.
 *
 * Each row is laid out in two blocks — the text block and the action block —
 * that sit side by side on a wide screen and stack on a phone. The first
 * version put badges, title, slug and four icon buttons in one flex row, so on
 * a 390px screen the title truncated to a few letters and the meta line broke
 * in the middle of "lượt xem". Now the title may take two lines, the meta is a
 * row of chips that wrap as whole units, and the buttons never squeeze text.
 */
export function BlogAdminList() {
  const toast = useToast();
  const utils = trpc.useUtils();
  const list = trpc.blog.adminList.useQuery(undefined, { retry: false });
  const cats = trpc.blog.categories.useQuery().data ?? [];
  const labelOf = (slug: string) => cats.find((c) => c.slug === slug)?.name ?? CATEGORY_LABEL[slug] ?? slug;
  const [filter, setFilter] = useState<Filter>("all");
  const remove = trpc.blog.remove.useMutation({
    onSuccess: () => {
      utils.blog.adminList.invalidate();
      toast("Đã xoá bài", "success");
    },
    onError: () => toast("Không xoá được", "error"),
  });

  const posts = useMemo(() => list.data ?? [], [list.data]);
  const counts = useMemo(() => {
    const c = { all: posts.length, published: 0, scheduled: 0, draft: 0 };
    for (const p of posts) c[stateOf(p)] += 1;
    return c;
  }, [posts]);
  const shown = filter === "all" ? posts : posts.filter((p) => stateOf(p) === filter);

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

  const iconBtn =
    "text-muted-foreground hover:bg-muted hover:text-foreground flex h-9 w-9 items-center justify-center rounded-lg transition-colors";

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8">
      <div className="border-border bg-card rounded-3xl border p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-foreground text-2xl font-bold">Quản lý blog</h1>
            <p className="text-muted-foreground text-sm">
              {posts.length} bài · {counts.published} đã đăng
              {counts.scheduled > 0 && ` · ${counts.scheduled} lên lịch`}
              {counts.draft > 0 && ` · ${counts.draft} nháp`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/blog"
              target="_blank"
              className="border-border text-muted-foreground hover:text-foreground inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm"
            >
              <Newspaper className="h-4 w-4" /> Xem blog
            </Link>
            <Link
              href="/admin/blog/new"
              className="bg-accent inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Viết bài
            </Link>
          </div>
        </div>

        <details className="border-border mb-4 rounded-2xl border p-3 text-sm">
          <summary className="text-muted-foreground flex cursor-pointer items-center gap-1.5 font-medium">
            <Tags className="h-4 w-4" /> Quản lý danh mục
          </summary>
          <div className="mt-3">
            <CategoryManager />
          </div>
        </details>

        {posts.length > 0 && (
          <div role="tablist" aria-label="Lọc theo trạng thái" className="-mx-1 mb-2 flex gap-1 overflow-x-auto px-1 pb-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === f.key ? "bg-accent text-white" : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label} <span className="tabular-nums opacity-70">{counts[f.key]}</span>
              </button>
            ))}
          </div>
        )}

        {posts.length === 0 ? (
          <p className="text-muted-foreground rounded-2xl border border-dashed border-border p-10 text-center">
            Chưa có bài nào. Bấm “Viết bài” để bắt đầu.
          </p>
        ) : shown.length === 0 ? (
          <p className="text-muted-foreground rounded-2xl border border-dashed border-border p-8 text-center text-sm">
            Không có bài nào ở trạng thái này.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {shown.map((p) => {
              const state = stateOf(p);
              const badge = BADGE[state];
              return (
                <li key={p.id} className="py-3.5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                    {/* Thumbnail on wide screens only — on a phone it would push
                        the title into a narrow column beside it. */}
                    <Link
                      href={`/admin/blog/${p.id}`}
                      className="bg-muted hidden h-14 w-[5.6rem] shrink-0 overflow-hidden rounded-lg sm:block"
                      aria-hidden="true"
                      tabIndex={-1}
                    >
                      {p.coverImage ? (
                        <img src={cldThumb(p.coverImage, 240)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="from-accent-soft to-muted h-full w-full bg-gradient-to-br" />
                      )}
                    </Link>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${badge.cls}`}>{badge.text}</span>
                        {p.featured && (
                          <span className="text-accent inline-flex items-center gap-0.5 font-semibold">
                            <Star className="h-3 w-3 fill-current" /> Nổi bật
                          </span>
                        )}
                        <span className="text-muted-foreground">{labelOf(p.category)}</span>
                      </div>
                      <Link
                        href={`/admin/blog/${p.id}`}
                        className="text-foreground hover:text-accent mt-1 block font-medium leading-snug [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden"
                      >
                        {p.title}
                      </Link>
                      <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                        <span className="min-w-0 max-w-full truncate">/blog/{p.slug}</span>
                        <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
                          <Eye className="h-3 w-3" aria-hidden="true" /> {p.viewCount}
                        </span>
                        {state === "scheduled" && p.publishedAt ? (
                          <span className="inline-flex shrink-0 items-center gap-1 text-amber-700">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            {new Date(p.publishedAt).toLocaleString("vi-VN", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        ) : p.publishedAt ? (
                          <span className="shrink-0 tabular-nums">{viDate(p.publishedAt)}</span>
                        ) : null}
                      </p>
                    </div>

                    <div className="-ml-1.5 flex shrink-0 items-center gap-0.5 sm:ml-0">
                      {state === "published" && (
                        <Link href={`/blog/${p.slug}`} target="_blank" aria-label="Xem bài" title="Xem bài" className={iconBtn}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      )}
                      <Link href={`/admin/blog/${p.id}/preview`} target="_blank" aria-label="Xem trước" title="Xem trước" className={iconBtn}>
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Link href={`/admin/blog/${p.id}`} aria-label="Sửa" title="Sửa" className={iconBtn}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <ConfirmButton
                        idle=""
                        icon={<Trash2 className="h-4 w-4" />}
                        aria-label="Xoá bài"
                        title="Xoá bài này?"
                        description={`"${p.title}" sẽ bị xoá vĩnh viễn.`}
                        disabled={remove.isPending}
                        className={cn(iconBtn, "hover:bg-destructive-soft hover:text-destructive")}
                        onConfirm={() => remove.mutate({ id: p.id })}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
