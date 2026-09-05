import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { publicCaller } from "@/server/caller";
import { ArticleCard, CATEGORY_LABEL } from "@/features/blog/post-card";
import { ViewBeacon } from "@/features/blog/view-beacon";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "@/features/blog/blog-body.css";

export const revalidate = 300;

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
      publishedTime: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
    },
  };
}

function viDate(d: string | Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("vi-VN", { day: "numeric", month: "long", year: "numeric" });
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const [popular, more] = await Promise.all([
    publicCaller.blog.popular({ limit: 4 }),
    publicCaller.blog.list({ category: post.category as never, page: 1, pageSize: 4 }),
  ]);
  const related = more.items.filter((p) => p.slug !== post.slug).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.coverImage || `${SITE_URL}/og-card.jpg`,
    datePublished: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME },
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:pt-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ViewBeacon slug={post.slug} />

      <nav className="text-muted-foreground mb-4 text-sm">
        <Link href="/blog" className="hover:text-accent">
          Blog
        </Link>
        <span className="px-1.5">/</span>
        <span>{CATEGORY_LABEL[post.category] ?? post.category}</span>
      </nav>

      {/* One paper card on the app's backdrop, the same way every app screen
          puts its content on a surface over the ambient art. */}
      <div className="border-border bg-card rounded-3xl border p-5 shadow-sm sm:p-8">
      <header className="mb-6">
        <span className="text-accent text-sm font-semibold">
          {CATEGORY_LABEL[post.category] ?? post.category}
        </span>
        <h1 className="text-foreground mt-1 text-3xl font-bold leading-tight sm:text-4xl [font-family:var(--font-display)]">
          {post.title}
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">{viDate(post.publishedAt)}</p>
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

      {related.length > 0 && (
        <section className="border-border mt-12 border-t pt-8">
          <h2 className="text-foreground mb-4 text-lg font-bold">Bài viết liên quan</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {related.map((p) => (
              <ArticleCard key={p.slug} post={p} />
            ))}
          </div>
        </section>
      )}

      {popular.length > 0 && related.length === 0 && (
        <section className="border-border mt-12 border-t pt-8">
          <h2 className="text-foreground mb-4 text-lg font-bold">Đọc nhiều</h2>
          <ul className="space-y-2">
            {popular
              .filter((p) => p.slug !== post.slug)
              .map((p) => (
                <li key={p.slug}>
                  <Link href={`/blog/${p.slug}`} className="text-accent hover:underline">
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
