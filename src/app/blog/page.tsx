import type { Metadata } from "next";
import { SITE_WIDTH } from "@/lib/site-width";
import Link from "next/link";
import { Search } from "lucide-react";
import { publicCaller } from "@/server/caller";
import { ArticleCard, CATEGORY_LABEL } from "@/features/blog/post-card";
import { CategoryTabs } from "@/features/blog/category-tabs";
import { ReadingPathStrip } from "@/features/blog/reading-path-strip";
import { READING_PATH } from "@/features/blog/reading-path";
import { LinkPending } from "@/components/ui/link-pending";
import { FadeScroll } from "@/components/ui/fade-scroll";
import { coverAt } from "@/lib/blog-image";
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
  const [featured, popular, recent, cats, pathPosts] = await Promise.all([
    publicCaller.blog.featured({ limit: 1 }),
    publicCaller.blog.popular({ limit: 5 }),
    publicCaller.blog.list({ page: 1, pageSize: 24 }),
    publicCaller.blog.categories(),
    /*
     * The guided path is resolved post by post rather than filtered out of the
     * recent list: once the blog outgrows one page, a step's post would drop
     * off the list and the path would silently lose it. A step whose post has
     * been unpublished is dropped here instead of linking to a 404.
     */
    Promise.all(
      READING_PATH.map((s) =>
        publicCaller.blog.bySlug({ slug: s.slug }).then(
          (p) => ({ slug: p.slug, title: p.title }),
          () => null,
        ),
      ),
    ),
  ]);
  const labelOf = (slug: string) =>
    cats.find((c) => c.slug === slug)?.name ?? CATEGORY_LABEL[slug] ?? slug;
  const hero = featured[0] ?? recent.items[0] ?? null;
  const rest = recent.items.filter((p) => p.slug !== hero?.slug);
  const liveTitles = Object.fromEntries(
    pathPosts.flatMap((p) => (p ? [[p.slug, p.title]] : [])),
  );
  const steps = READING_PATH.filter((s) => liveTitles[s.slug]);

  return (
    <main className={`mx-auto w-full ${SITE_WIDTH} px-4 pb-16 pt-8 sm:pt-12`}>
      <header className="mb-6">
        <p className="text-accent text-sm font-semibold">Blog</p>
        <h1 className="text-foreground mt-1 text-3xl font-bold sm:text-4xl [font-family:var(--font-display)]">
          Chuyện của Vivu No Plan
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">{DESCRIPTION}</p>
        {/* Stacked on a phone — the tab row needs the whole width to scroll —
            and one row from sm up, search on the right. */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <CategoryTabs
            categories={cats}
            active={null}
            className="sm:min-w-0 sm:flex-1"
          />
          <Link
            href="/blog/tim-kiem"
            className="border-border bg-card hover:border-accent/40 text-muted-foreground inline-flex shrink-0 items-center gap-2 self-start rounded-full border px-4 py-1.5 text-sm shadow-sm sm:self-auto"
          >
            <Search className="h-4 w-4" /> Tìm bài viết
          </Link>
        </div>
      </header>

      {/* The path first, before anything sorted by date: a first-time visitor
          needs "where do I start", not "what is newest". */}
      {steps.length > 0 && (
        <ReadingPathStrip steps={steps} titles={liveTitles} className="mb-8" />
      )}

      {recent.items.length === 0 ? (
        <p className="text-muted-foreground rounded-2xl border border-dashed border-border p-10 text-center">
          Chưa có bài viết nào. Ghé lại sau nhé 💛
        </p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start xl:gap-10 xl:grid-cols-[1fr_24rem] 2xl:grid-cols-[1fr_28rem]">
          <div>
            {hero && (
              <Link
                href={`/blog/${hero.slug}`}
                className="group border-border bg-card hover:border-accent/40 relative mb-8 grid overflow-hidden rounded-3xl border shadow-sm transition-colors sm:grid-cols-2"
              >
                <LinkPending />
                <div className="bg-muted relative aspect-[16/10] overflow-hidden sm:aspect-auto">
                  {hero.coverImage ? (
                    <img
                      src={coverAt(hero.coverImage, 1200)}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="from-accent-soft to-muted h-full min-h-52 w-full bg-gradient-to-br" />
                  )}
                </div>
                <div className="flex flex-col justify-center gap-3 p-6">
                  <span className="text-accent text-xs font-semibold">
                    {labelOf(hero.category)} · Nổi bật
                  </span>
                  <h2 className="text-foreground text-2xl font-bold leading-tight group-hover:text-accent">
                    {hero.title}
                  </h2>
                  {hero.excerpt && (
                    <p className="text-muted-foreground">{hero.excerpt}</p>
                  )}
                </div>
              </Link>
            )}

            <h2 className="text-foreground mb-3 text-sm font-semibold">
              Mới nhất
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {rest.map((post, i) => (
                <ArticleCard
                  key={post.slug}
                  post={post}
                  priority={i < 2}
                  categoryLabel={labelOf(post.category)}
                />
              ))}
            </div>

            {/* Pagination is intentionally omitted for now: the index stays a
                fully static page. With more posts it becomes /blog/trang/[n]
                static routes rather than a ?page query that turns this dynamic. */}
          </div>

          {/* Follows the reader down the list, and never taller than the
              screen: capped, it scrolls inside with a fade at the edge that
              still hides something, rather than being cut off out of reach. */}
          <aside className="lg:sticky lg:top-24 lg:flex lg:max-h-[calc(100dvh-7rem)] lg:flex-col">
            <FadeScroll
              className="space-y-5 lg:pr-0.5"
              fadeClassName="from-background"
              hideScrollbar
            >
              {popular.length > 0 && (
                <div className="border-border bg-card rounded-2xl border p-4 shadow-sm">
                  <h2 className="text-foreground mb-3 text-sm font-semibold">
                    Đọc nhiều
                  </h2>
                  <ol className="space-y-3">
                    {popular.map((post, i) => (
                      <li key={post.slug}>
                        <Link
                          href={`/blog/${post.slug}`}
                          className="group flex gap-3"
                        >
                          <span className="text-accent/40 text-lg font-bold leading-none tabular-nums">
                            {i + 1}
                          </span>
                          <span className="text-foreground group-hover:text-accent line-clamp-2 text-sm font-medium xl:line-clamp-3">
                            {post.title}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="border-border bg-card rounded-2xl border p-4 shadow-sm">
                <h2 className="text-foreground mb-3 text-sm font-semibold">
                  Danh mục
                </h2>
                <ul className="space-y-1.5">
                  {cats.map((c) => (
                    <li key={c.slug}>
                      <Link
                        href={`/blog/danh-muc/${c.slug}`}
                        className="text-foreground hover:text-accent flex items-center justify-between text-sm"
                      >
                        <span>{c.name}</span>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {
                            recent.items.filter((p) => p.category === c.slug)
                              .length
                          }
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeScroll>
          </aside>
        </div>
      )}
    </main>
  );
}
