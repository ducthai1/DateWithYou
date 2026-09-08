import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicCaller } from "@/server/caller";
import { ArticleCard, CATEGORY_LABEL } from "@/features/blog/post-card";
import { CategoryTabs } from "@/features/blog/category-tabs";
import { SITE_NAME } from "@/lib/site";

/*
 * One category of the blog, as its own static page.
 *
 * The same ISR treatment as the index: pre-rendered for every category that
 * exists at build time, rendered on first request for one added later, and
 * refreshed on a schedule. A filter this could have been a `?danh-muc=` query
 * on /blog — but that turns the index dynamic and gives a crawler nothing to
 * follow; a URL per category costs nothing and reads better.
 */
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

export async function generateStaticParams() {
  try {
    const cats = await publicCaller.blog.categories();
    return cats.map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

async function categoryOf(slug: string) {
  const cats = await publicCaller.blog.categories();
  return { cats, cat: cats.find((c) => c.slug === slug) ?? null };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { cat } = await categoryOf(slug);
  const name = cat?.name ?? CATEGORY_LABEL[slug] ?? slug;
  const title = `${name} — Blog ${SITE_NAME}`;
  const description = `Những bài viết thuộc mục ${name} trên blog ${SITE_NAME}.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/blog/danh-muc/${slug}` },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      url: `/blog/danh-muc/${slug}`,
      title,
      description,
      images: [{ url: "/og-card.jpg", width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function BlogCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [{ cats, cat }, list] = await Promise.all([
    categoryOf(slug),
    publicCaller.blog.list({ category: slug, page: 1, pageSize: 24 }),
  ]);
  if (!cat) notFound();
  const labelOf = (s: string) => cats.find((c) => c.slug === s)?.name ?? CATEGORY_LABEL[s] ?? s;

  return (
    <main className="mx-auto w-full max-w-6xl 2xl:max-w-7xl px-4 pb-16 pt-8 sm:pt-12">
      <header className="mb-8">
        <nav className="text-muted-foreground text-sm">
          <Link href="/blog" className="hover:text-accent">
            Blog
          </Link>
          <span className="px-1.5">/</span>
          <span>Danh mục</span>
        </nav>
        <h1 className="text-foreground mt-1 text-3xl font-bold sm:text-4xl [font-family:var(--font-display)]">
          {cat.name}
        </h1>
        <p className="text-muted-foreground mt-2">
          {list.total === 0 ? "Chưa có bài nào trong mục này." : `${list.total} bài viết`}
        </p>
        <CategoryTabs categories={cats} active={slug} className="mt-4" />
      </header>

      {list.items.length === 0 ? (
        <p className="text-muted-foreground rounded-2xl border border-dashed border-border p-10 text-center">
          Mục này chưa có bài. Xem{" "}
          <Link href="/blog" className="text-accent hover:underline">
            tất cả bài viết
          </Link>{" "}
          nhé.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.items.map((post, i) => (
            <ArticleCard key={post.slug} post={post} priority={i < 3} categoryLabel={labelOf(post.category)} />
          ))}
        </div>
      )}
    </main>
  );
}
