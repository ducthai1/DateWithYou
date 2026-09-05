"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { ArticleCard } from "@/features/blog/post-card";
import { Search, Loader2, ArrowLeft } from "lucide-react";

/** Hold back a fast-changing value so we don't query on every keystroke. */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Blog search. Its own client page, kept off the static /blog bundle so the
 * index still ships zero data-fetching JavaScript — the tRPC client loads only
 * for the reader who actually opens search.
 */
export function BlogSearch() {
  const [q, setQ] = useState("");
  const query = useDebounced(q.trim(), 300);
  const res = trpc.blog.search.useQuery(
    { q: query, limit: 18 },
    { enabled: query.length > 0, staleTime: 60_000 },
  );
  const items = res.data ?? [];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:pt-12">
      <Link href="/blog" className="text-muted-foreground hover:text-accent mb-4 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="h-4 w-4" /> Về Blog
      </Link>
      <h1 className="text-foreground mb-4 text-2xl font-bold sm:text-3xl [font-family:var(--font-display)]">
        Tìm bài viết
      </h1>

      <div className="border-border bg-card focus-within:border-accent mb-8 flex items-center gap-2 rounded-full border px-4 py-2.5 shadow-sm">
        <Search className="text-muted-foreground h-4 w-4 shrink-0" />
        <input
          autoFocus
          aria-label="Từ khoá tìm kiếm"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nhập từ khoá: tính năng, mẹo, bản đồ…"
          className="text-foreground w-full bg-transparent text-sm outline-none"
        />
        {res.isFetching && <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />}
      </div>

      {query.length === 0 ? (
        <p className="text-muted-foreground text-sm">Gõ để tìm theo tiêu đề, tóm tắt hoặc thẻ.</p>
      ) : items.length === 0 && !res.isFetching ? (
        <p className="text-muted-foreground border-border rounded-2xl border border-dashed p-10 text-center">
          Không có bài nào khớp “{query}”.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((post) => (
            <ArticleCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </main>
  );
}
