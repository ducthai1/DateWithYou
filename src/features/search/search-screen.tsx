"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCw, Search, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { KIND_META, SearchResultRow, type SearchHit } from "./search-result-row";

const DEBOUNCE_MS = 250;
const MAX_QUERY = 80; // mirrors the procedure's zod bound

/**
 * Cross-collection search: kỷ niệm, địa điểm, bộ sưu tập, lịch trình, chuyến đi.
 *
 * Typing is debounced, results are grouped by kind, and ↑/↓ walk the flattened
 * list by moving real DOM focus onto each row — so Enter opens it natively and
 * Escape always gets the user back to the box instead of trapping them.
 */
export function SearchScreen() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [active, setActive] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const id = window.setTimeout(() => setQ(text.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [text]);

  // A new query invalidates the cursor — never leave it pointing at row 7 of a
  // list that now has two rows.
  useEffect(() => setActive(-1), [q]);

  const enabled = q.length > 0;
  const results = trpc.search.query.useQuery({ q }, { enabled, staleTime: 30_000 });

  const data = results.data;
  // One flat, stable ordering shared by the rendered sections and the arrow-key
  // cursor: each row carries the index it occupies in `flat`.
  const sections = useMemo(() => {
    let cursor = 0;
    return (data?.groups ?? []).map((group) => ({
      kind: group.kind,
      rows: group.items.map((hit) => ({ hit, index: cursor++ })),
    }));
  }, [data]);
  const flat = useMemo<SearchHit[]>(
    () => sections.flatMap((s) => s.rows.map((r) => r.hit)),
    [sections],
  );

  function focusRow(index: number) {
    setActive(index);
    rowRefs.current[index]?.focus();
  }

  function moveBy(delta: number) {
    if (flat.length === 0) return;
    const next = active + delta;
    if (next < 0) {
      setActive(-1);
      inputRef.current?.focus();
      return;
    }
    focusRow(Math.min(next, flat.length - 1));
  }

  function clearQuery() {
    setText("");
    setQ("");
    setActive(-1);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveBy(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveBy(-1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      clearQuery();
    } else if (e.key === "Enter" && active < 0 && flat.length > 0) {
      // Enter straight from the box opens the top hit.
      e.preventDefault();
      router.push(flat[0].href);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-5 px-4 pt-6 pb-6 md:px-[30px]">
      <div className="space-y-1">
        <h1 className="text-accent text-2xl font-semibold">Tìm kiếm</h1>
        <p className="text-muted-foreground text-sm">
          Gõ vài chữ là tụi mình lục lại kỷ niệm, quán xá, công thức, lịch trình và chuyến đi.
        </p>
      </div>

      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          value={text}
          maxLength={MAX_QUERY}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Tìm trong không gian của tụi mình"
          placeholder="cà phê, Đà Lạt, bún bò…"
          autoComplete="off"
          className="border-border bg-card text-foreground placeholder:text-muted-foreground h-12 w-full rounded-xl border pr-12 pl-9 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        {text.length > 0 && (
          <button
            type="button"
            onClick={clearQuery}
            aria-label="Xoá ô tìm kiếm"
            className="text-muted-foreground hover:bg-muted absolute top-1/2 right-1.5 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Idle — nothing typed yet. */}
      {!enabled && (
        <EmptyState
          icon="sparkles"
          title="Tìm gì đó đi"
          subtitle="Không dấu cũng được — gõ “ca phe” là ra “cà phê” nhé."
        />
      )}

      {/* Loading — real shapes, so an in-flight search never looks like “chưa có gì”. */}
      {enabled && results.isLoading && (
        <div className="space-y-3" aria-hidden="true">
          <Skeleton variant="text" className="w-28" />
          <Skeleton className="h-[52px] w-full" />
          <Skeleton className="h-[52px] w-full" />
          <Skeleton variant="text" className="mt-4 w-24" />
          <Skeleton className="h-[52px] w-full" />
        </div>
      )}

      {/* Error — say so, and offer the way back. */}
      {enabled && results.isError && (
        <div className="border-border bg-card space-y-3 rounded-xl border p-5 text-center">
          <p className="font-medium">Chưa tìm được</p>
          <p className="text-muted-foreground text-sm">
            Mạng trục trặc một chút thôi. Thử lại giúp tụi mình nhé.
          </p>
          <Button variant="outline" onClick={() => results.refetch()}>
            <RotateCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Thử lại
          </Button>
        </div>
      )}

      {/* No hits. */}
      {enabled && !results.isLoading && !results.isError && flat.length === 0 && (
        <EmptyState
          icon="map-pin"
          title={`Không tìm thấy gì với “${q}”`}
          subtitle="Thử một từ ngắn hơn, hoặc bỏ dấu đi xem sao."
          action={{ label: "Xoá ô tìm kiếm", onClick: clearQuery }}
        />
      )}

      {/* Hits, grouped. */}
      {enabled && !results.isError && flat.length > 0 && (
        <div className="space-y-6">
          <p className="text-muted-foreground text-xs" aria-live="polite">
            {flat.length} kết quả cho “{q}”
          </p>
          {sections.map((section) => {
            const meta = KIND_META[section.kind];
            return (
              <section key={section.kind} className="space-y-2">
                <h2 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                  <meta.Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {meta.label}
                  <span className="font-normal normal-case">({section.rows.length})</span>
                </h2>
                <div className="space-y-2">
                  {section.rows.map(({ hit, index }) => (
                    <SearchResultRow
                      key={`${hit.kind}-${hit.id}`}
                      hit={hit}
                      active={active === index}
                      linkRef={(el) => {
                        rowRefs.current[index] = el;
                      }}
                      onFocus={() => setActive(index)}
                      onKeyDown={handleKeyDown}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
