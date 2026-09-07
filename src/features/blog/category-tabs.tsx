import Link from "next/link";
import { cn } from "@/lib/utils";
import { CATEGORY_LABEL } from "./post-card";

export type CategoryTab = { slug: string; name: string };

/**
 * Category filter as a row of links, not a client-side filter.
 *
 * Each tab is its own static route (/blog and /blog/danh-muc/<slug>), so the
 * index stays a page the CDN can hand out whole and a crawler can follow every
 * category. A `?danh-muc=` query would have turned the index dynamic for the
 * sake of a filter. Scrolls sideways on a phone rather than wrapping into a
 * second ragged line.
 */
export function CategoryTabs({
  categories,
  active,
  className,
}: {
  categories: CategoryTab[];
  /** The category slug in view, or null on the all-posts index. */
  active: string | null;
  className?: string;
}) {
  const tab = (href: string, label: string, isActive: boolean, key: string) => (
    <Link
      key={key}
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        isActive
          ? "border-accent bg-accent text-white"
          : "border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Danh mục bài viết" className={cn("min-w-0 overflow-x-auto [scrollbar-width:none]", className)}>
      <div className="flex w-max gap-2 pb-1 pr-4">
        {tab("/blog", "Tất cả", active === null, "all")}
        {categories.map((c) =>
          tab(`/blog/danh-muc/${c.slug}`, c.name || CATEGORY_LABEL[c.slug] || c.slug, active === c.slug, c.slug),
        )}
      </div>
    </nav>
  );
}
