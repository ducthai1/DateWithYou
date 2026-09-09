import type { Metadata } from "next";
import { SITE_WIDTH } from "@/lib/site-width";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { publicCaller } from "@/server/caller";
import { ArticleCard, CATEGORY_LABEL } from "@/features/blog/post-card";
import { ViewBeacon } from "@/features/blog/view-beacon";
import { ArticleView } from "@/features/blog/article-view";
import { withHeadingAnchors } from "@/features/blog/toc";
import { FadeScroll } from "@/components/ui/fade-scroll";
import { SmartBackLink } from "@/components/marketing/smart-back-link";
import { TocRail } from "@/features/blog/toc-rail";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "@/features/blog/blog-body.css";

export const revalidate = 300;
/*
 * Without this the page was rendered on EVERY request. The root layout reads
 * the tone cookie, which makes each route dynamic by default; `revalidate` and
 * generateStaticParams alone do not override that (the build table even showed
 * ● for this route while the prerender manifest had no entry for it). Forcing
 * static is what the index already did — the posts now prerender at build,
 * are served from the CDN, and a new one renders once on first request.
 */
export const dynamic = "force-static";

/** Pre-render the posts that exist at build time; anything published later is
 *  rendered on first request and then cached (dynamicParams defaults on). */
export async function generateStaticParams() {
  try {
    const { items } = await publicCaller.blog.list({ page: 1, pageSize: 24 });
    return items.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

async function getPost(slug: string) {
  try {
    return await publicCaller.blog.bySlug({ slug });
  } catch (e) {
    if (e instanceof TRPCError && e.code === "NOT_FOUND") return null;
    throw e;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Không tìm thấy bài viết" };
  const title = post.metaTitle || post.title;
  const description = post.metaDescription || post.excerpt || SITE_NAME;
  const image = post.coverImage || "/og-card.jpg";
  return {
    title: { absolute: `${title} — ${SITE_NAME}` },
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      url: `/blog/${post.slug}`,
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
      publishedTime: post.publishedAt
        ? new Date(post.publishedAt).toISOString()
        : undefined,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const [popular, more, cats] = await Promise.all([
    publicCaller.blog.popular({ limit: 4 }),
    publicCaller.blog.list({ category: post.category, page: 1, pageSize: 4 }),
    publicCaller.blog.categories(),
  ]);
  const labelOf = (slug: string) =>
    cats.find((c) => c.slug === slug)?.name ?? CATEGORY_LABEL[slug] ?? slug;
  const related = more.items.filter((p) => p.slug !== post.slug).slice(0, 3);

  const { html: bodyHtml, toc } = withHeadingAnchors(post.body);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.coverImage || `${SITE_URL}/og-card.jpg`,
    datePublished: post.publishedAt
      ? new Date(post.publishedAt).toISOString()
      : undefined,
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME },
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
  };

  /*
   * Two columns from lg up: the article, and a side column that follows the
   * reader down the page. A lone 48rem column looked like a strip left in the
   * middle of a wide screen; the second column is what makes the width feel
   * used rather than empty. Below lg the contents collapse into a <details>
   * above the article — always-open it cost a whole screen on a phone.
   */
  return (
    <main className={`mx-auto w-full ${SITE_WIDTH} px-4 pb-16 pt-6 sm:pt-10`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ViewBeacon slug={post.slug} />

      {/* A back button that returns where the reader came from — the feature
          page, the landing, the app — plus the breadcrumb for structure. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <SmartBackLink fallback="/blog" tone="app" />
        <nav aria-label="Đường dẫn" className="text-muted-foreground text-sm">
          <Link href="/blog" className="hover:text-accent">
            Blog
          </Link>
          <span className="px-1.5">/</span>
          <Link
            href={`/blog/danh-muc/${post.category}`}
            className="hover:text-accent"
          >
            {labelOf(post.category)}
          </Link>
        </nav>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:gap-10 xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_28rem]">
        <div className="min-w-0">
          {toc.length >= 3 && (
            <details className="border-border bg-card mb-4 rounded-2xl border p-4 shadow-sm lg:hidden">
              <summary className="text-foreground cursor-pointer text-sm font-semibold">
                Mục lục
              </summary>
              <ul className="mt-3 space-y-1.5 text-sm">
                {toc.map((h) => (
                  <li key={h.id} className={h.level === 3 ? "ml-4" : ""}>
                    <a
                      href={`#${h.id}`}
                      className="text-muted-foreground hover:text-accent"
                    >
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <ArticleView
            post={{ ...post, body: bodyHtml }}
            categoryLabel={labelOf(post.category)}
          />
        </div>
        {/*
          Sticky, and scrollable inside its own box: a ten-heading contents plus
          "Đọc nhiều" is taller than a laptop viewport, and a sticky block that
          overflows simply hides its own bottom half.
        */}
        {/*
          `sticky` goes on the grid ITEM, not on a child of it. With
          `lg:items-start` the column shrinks to its content, so a sticky child
          has no room to travel inside it and simply scrolls away with the page
          — which is exactly what happened here: measured at -3437px halfway
          down the article. A sticky grid item travels its whole grid area.

          No overflow on this column any more. Making the whole aside a scroll
          box meant that pointing at it and scrolling moved the little panel
          instead of the article, which is the last thing a reader expects. The
          contents list caps its own height instead (see TocRail), so only that
          list ever scrolls and everything under it stays in place.
        */}
        {/*
          Follows the reader down, and never taller than the screen.

          A sticky column that outgrows the viewport is cut off at the bottom —
          the last few links, unreachable, because the page scrolls and the
          column does not. Capped to the height the screen actually has, it
          scrolls inside instead, with a fade at whichever edge still hides
          something and no scrollbar, which in a column of links reads as a
          second page inside the page.
        */}
        <aside className="hidden lg:sticky lg:top-24 lg:flex lg:max-h-[calc(100dvh-7rem)] lg:flex-col">
          <FadeScroll
            className="space-y-5 lg:pr-0.5"
            fadeClassName="from-background"
            hideScrollbar
          >
            {toc.length >= 3 && <TocRail items={toc} />}
            {popular.length > 0 && (
              <section className="border-border bg-card rounded-2xl border p-4 shadow-sm">
                <h2 className="text-foreground mb-2 text-sm font-semibold">
                  Đọc nhiều
                </h2>
                <ol className="space-y-2">
                  {popular
                    .filter((p) => p.slug !== post.slug)
                    .slice(0, 3)
                    .map((p, i) => (
                      <li key={p.slug}>
                        <Link
                          href={`/blog/${p.slug}`}
                          className="group flex gap-2 text-sm"
                        >
                          <span className="text-accent/40 font-bold tabular-nums">
                            {i + 1}
                          </span>
                          <span className="text-muted-foreground group-hover:text-accent line-clamp-2 xl:line-clamp-3">
                            {p.title}
                          </span>
                        </Link>
                      </li>
                    ))}
                </ol>
              </section>
            )}
          </FadeScroll>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="border-border mt-12 border-t pt-8">
          <h2 className="text-foreground mb-4 text-lg font-bold">
            Bài viết liên quan
          </h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {related.map((p) => (
              <ArticleCard
                key={p.slug}
                post={p}
                categoryLabel={labelOf(p.category)}
              />
            ))}
          </div>
        </section>
      )}

      {popular.length > 0 && related.length === 0 && (
        <section className="border-border mt-12 border-t pt-8 lg:hidden">
          <h2 className="text-foreground mb-4 text-lg font-bold">Đọc nhiều</h2>
          <ul className="space-y-2">
            {popular
              .filter((p) => p.slug !== post.slug)
              .map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/blog/${p.slug}`}
                    className="text-accent hover:underline"
                  >
                    {p.title}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}
    </main>
  );
}
