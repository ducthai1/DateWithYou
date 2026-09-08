"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { coverAt } from "@/lib/blog-image";
import { useToast } from "@/components/ui/toast";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { CATEGORY_LABEL } from "@/features/blog/post-card";
import { Pencil, Plus, Trash2, ExternalLink, Loader2, Eye, Clock, Tags, Newspaper, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { CategoryManager } from "@/features/blog/admin/category-manager";

type Filter = "all" | "published" | "scheduled" | "draft";

/** Rows per page. Eight fit a laptop frame without the list ever needing to scroll far. */
const PAGE_SIZE = 8;

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
  const [pageNo, setPageNo] = useState(1);
  // A new filter starts from its first page — page 3 of "Nháp" rarely exists.
  useEffect(() => setPageNo(1), [filter]);
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
  const filtered = filter === "all" ? posts : posts.filter((p) => stateOf(p) === filter);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(pageNo, pageCount);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const rangeLabel = filtered.length
    ? `${(current - 1) * PAGE_SIZE + 1}–${Math.min(current * PAGE_SIZE, filtered.length)} / ${filtered.length}`
    : "0 bài";

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
    /*
     * The frame does not scroll — the rows do. Title, category manager, filters
     * and the pager stay put at the top and the list below them owns the
     * scroll box, so paging and filtering are always one press away instead of
     * a scroll back up. The pager sits UP HERE for the same reason: the bottom
     * of a scroll box is the one place you cannot see while reading its top.
     */
    <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col px-4 py-4 sm:py-6">
      <div className="border-border bg-card flex min-h-0 flex-1 flex-col rounded-3xl border p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div role="tablist" aria-label="Lọc theo trạng thái" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
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
            {pageCount > 1 && (
              /* The pager as a film strip: one frame per page, the current one
                 wide and named, the rest thin ticks you can press. Reads as
                 "where am I in the stack" rather than a row of numbers. */
              <nav aria-label="Trang" className="flex items-center gap-2">
                <span className="text-muted-foreground hidden text-xs tabular-nums sm:inline">{rangeLabel}</span>
                <div className="bg-muted flex items-center gap-1 rounded-full p-1">
                  <button
                    type="button"
                    aria-label="Trang trước"
                    disabled={current === 1}
                    onClick={() => setPageNo((n) => Math.max(1, n - 1))}
                    className="text-muted-foreground hover:text-foreground flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-label={`Trang ${n}`}
                      aria-current={n === current ? "page" : undefined}
                      onClick={() => setPageNo(n)}
                      className={cn(
                        "flex h-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-all",
                        n === current ? "bg-accent w-9 text-white shadow-sm" : "bg-card/80 text-muted-foreground hover:text-foreground w-2.5 hover:w-7",
                      )}
                    >
                      {n === current ? n : <span className="sr-only">{n}</span>}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-label="Trang sau"
                    disabled={current === pageCount}
                    onClick={() => setPageNo((n) => Math.min(pageCount, n + 1))}
                    className="text-muted-foreground hover:text-foreground flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </nav>
            )}
          </div>
        )}

        {posts.length === 0 ? (
          <p className="text-muted-foreground rounded-2xl border border-dashed border-border p-10 text-center">
            Chưa có bài nào. Bấm “Viết bài” để bắt đầu.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground rounded-2xl border border-dashed border-border p-8 text-center text-sm">
            Không có bài nào ở trạng thái này.
          </p>
        ) : (
          <ul className="divide-border -mx-2 min-h-0 flex-1 divide-y overflow-y-auto px-2 [scrollbar-gutter:stable]">
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
                        <img src={coverAt(p.coverImage, 640)} alt="" className="h-full w-full object-cover" />
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
