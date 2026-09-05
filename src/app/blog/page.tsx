import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { publicCaller } from "@/server/caller";
import { ArticleCard, CATEGORY_LABEL } from "@/features/blog/post-card";
import { SITE_NAME } from "@/lib/site";

/*
 * The blog index.
 *
 * A Server Component rendered statically and refreshed on a schedule (ISR), so
 * it ships no data-fetching JavaScript and adds nothing to the app's client
 * cost. Data is read through the in-process caller, not an HTTP round-trip.
 */
export const revalidate = 300;
// Force a cached, statically-generated page (refreshed every `revalidate`
// seconds) rather than a per-request render. The data comes from Mongoose,
// not fetch(), so Next cannot infer it is cacheable — this says so. A marketing
// index served from the CDN is the point.
export const dynamic = "force-static";

const TITLE = "Blog — Vivu No Plan";
const DESCRIPTION =
  "Tính năng mới, mẹo dùng, và những câu chuyện quanh Vivu No Plan — nơi lưu lại mọi chuyến đi của hai người.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: "/blog",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/og-card.jpg", width: 1200, height: 630, alt: TITLE }],
  },
};

export default async function BlogIndexPage() {
  const [featured, popular, recent] = await Promise.all([
    publicCaller.blog.featured({ limit: 1 }),
    publicCaller.blog.popular({ limit: 5 }),
    publicCaller.blog.list({ page: 1, pageSize: 12 }),
  ]);
  const hero = featured[0] ?? recent.items[0] ?? null;
  const rest = recent.items.filter((p) => p.slug !== hero?.slug);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:pt-12">
      <header className="mb-8">
        <p className="text-accent text-sm font-semibold">Blog</p>
        <h1 className="text-foreground mt-1 text-3xl font-bold sm:text-4xl [font-family:var(--font-display)]">
          Chuyện của Vivu No Plan
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">{DESCRIPTION}</p>
        <Link
          href="/blog/tim-kiem"
          className="border-border bg-card hover:border-accent/40 text-muted-foreground mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-sm"
        >
          <Search className="h-4 w-4" /> Tìm bài viết
        </Link>
      </header>

      {recent.items.length === 0 ? (
        <p className="text-muted-foreground rounded-2xl border border-dashed border-border p-10 text-center">
          Chưa có bài viết nào. Ghé lại sau nhé 💛
        </p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
          <div>
            {hero && (
              <Link
                href={`/blog/${hero.slug}`}
                className="group border-border bg-card hover:border-accent/40 mb-8 grid overflow-hidden rounded-3xl border shadow-sm transition-colors sm:grid-cols-2"
              >
                <div className="bg-muted relative aspect-[16/10] overflow-hidden sm:aspect-auto">
                  {hero.coverImage ? (
                          <img
                      src={`${hero.coverImage.includes("res.cloudinary.com") ? hero.coverImage.replace("/upload/", "/upload/c_fill,w_900,h_600,f_auto,q_auto/") : hero.coverImage}`}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="from-accent-soft to-muted h-full min-h-52 w-full bg-gradient-to-br" />
                  )}
                </div>
                <div className="flex flex-col justify-center gap-3 p-6">
                  <span className="text-accent text-xs font-semibold">
                    {CATEGORY_LABEL[hero.category] ?? hero.category} · Nổi bật
                  </span>
                  <h2 className="text-foreground text-2xl font-bold leading-tight group-hover:text-accent">
                    {hero.title}
                  </h2>
                  {hero.excerpt && <p className="text-muted-foreground">{hero.excerpt}</p>}
                </div>
              </Link>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              {rest.map((post, i) => (
                <ArticleCard key={post.slug} post={post} priority={i < 2} />
              ))}
            </div>

            {/* Pagination is intentionally omitted for now: the index stays a
                fully static page. With more posts it becomes /blog/trang/[n]
                static routes rather than a ?page query that turns this dynamic. */}
          </div>

          {popular.length > 0 && (
            <aside className="lg:pt-2">
              <h2 className="text-muted-foreground mb-3 text-sm font-semibold">Đọc nhiều</h2>
              <ol className="space-y-3">
                {popular.map((post, i) => (
                  <li key={post.slug}>
                    <Link href={`/blog/${post.slug}`} className="group flex gap-3">
                      <span className="text-accent/40 text-lg font-bold leading-none">{i + 1}</span>
                      <span className="text-foreground group-hover:text-accent line-clamp-2 text-sm font-medium">
                        {post.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </aside>
          )}
        </div>
      )}
    </main>
  );
}
