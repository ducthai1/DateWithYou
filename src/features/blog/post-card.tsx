import Link from "next/link";
import { cldThumb } from "@/lib/cloudinary-url";

export type PostCard = {
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  category: string;
  tags: string[];
  featured: boolean;
  viewCount: number;
  publishedAt: string | Date | null;
};

export const CATEGORY_LABEL: Record<string, string> = {
  "tin-tuc": "Tin tức",
  "tinh-nang": "Tính năng",
  "meo-hay": "Mẹo hay",
  "cap-nhat": "Cập nhật",
};

function viDate(d: string | Date | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("vi-VN", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * One article in a list. A Server Component: the cover is a plain <img> at a
 * thumbnail size (Cloudinary resizes; no client image component pulled in), so
 * a list of these ships no JavaScript.
 */
export function ArticleCard({
  post,
  priority = false,
  categoryLabel,
}: {
  post: PostCard;
  priority?: boolean;
  categoryLabel?: string;
}) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group border-border bg-card hover:border-accent/40 flex flex-col overflow-hidden rounded-2xl border shadow-sm transition-colors"
    >
      <div className="bg-muted relative aspect-[16/9] overflow-hidden">
        {post.coverImage ? (
          <img
            src={cldThumb(post.coverImage, 640)}
            alt=""
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="from-accent-soft to-muted h-full w-full bg-gradient-to-br" />
        )}
        <span className="bg-card/90 text-accent absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">
          {categoryLabel ?? CATEGORY_LABEL[post.category] ?? post.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-foreground line-clamp-2 text-base font-semibold leading-snug group-hover:text-accent">
          {post.title}
        </h3>
        {post.excerpt && <p className="text-muted-foreground line-clamp-2 text-sm">{post.excerpt}</p>}
        <p className="text-muted-foreground/80 mt-auto pt-1 text-xs">{viDate(post.publishedAt)}</p>
      </div>
    </Link>
  );
}
