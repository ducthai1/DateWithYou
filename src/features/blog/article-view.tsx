import { CATEGORY_LABEL } from "@/features/blog/post-card";
import "@/features/blog/blog-body.css";

function viDate(d: string | Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("vi-VN", { day: "numeric", month: "long", year: "numeric" });
}

export type ArticleViewPost = {
  category: string;
  title: string;
  publishedAt: string | Date | null;
  coverImage: string | null;
  body: string;
  tags: string[];
};

/**
 * The article's paper card — category, title, date, cover, body, tags.
 *
 * Shared verbatim by the public page and the admin preview, so a draft or a
 * scheduled post shows exactly what readers will get. No client hooks, so it
 * renders in a Server Component (the public page) and inside a client one (the
 * preview) alike.
 */
export function ArticleView({ post, categoryLabel }: { post: ArticleViewPost; categoryLabel?: string }) {
  return (
    <div className="border-border bg-card rounded-3xl border p-5 shadow-sm sm:p-8">
      <header className="mb-6">
        <span className="text-accent text-sm font-semibold">
          {categoryLabel ?? CATEGORY_LABEL[post.category] ?? post.category}
        </span>
        <h1 className="text-foreground mt-1 text-3xl font-bold leading-tight sm:text-4xl [font-family:var(--font-display)]">
          {post.title}
        </h1>
        {post.publishedAt && (
          <p className="text-muted-foreground mt-3 text-sm">{viDate(post.publishedAt)}</p>
        )}
      </header>

      {post.coverImage && (
        <div className="bg-muted mb-8 overflow-hidden rounded-2xl">
          <img
            src={
              post.coverImage.includes("res.cloudinary.com")
                ? post.coverImage.replace("/upload/", "/upload/c_limit,w_1200,f_auto,q_auto/")
                : post.coverImage
            }
            alt=""
            className="w-full object-cover"
          />
        </div>
      )}

      {/* Author HTML, rendered as-is behind .blog-body's non-!important defaults. */}
      <article className="blog-body" dangerouslySetInnerHTML={{ __html: post.body }} />

      {post.tags.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2">
          {post.tags.map((t) => (
            <span key={t} className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs">
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
