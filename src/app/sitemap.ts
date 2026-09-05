import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { MARKETING_ROUTES } from "@/components/marketing/feature-pages/slugs";
import { publicCaller } from "@/server/caller";

/**
 * Serves /sitemap.xml.
 *
 * Was a single entry for as long as the landing page was the only indexable
 * route. It still lists only genuinely indexable pages: everything else is
 * either behind auth or a thin auth screen, and submitting pages that are also
 * marked noindex reads as a contradictory signal.
 *
 * The feature pages come from the same array that renders them, so a page
 * cannot exist without being listed here, or be listed here without existing.
 */
/*
 * No lastModified field. It used to be `new Date()`, which is build time, not
 * content time — every deploy told Google all five pages had just changed,
 * including the four that had not. A crawler that checks a few of those and
 * finds nothing new learns to ignore the signal from this site entirely, so a
 * wrong date is worse than none. An absent lastmod is simply neutral.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = MARKETING_ROUTES.map((route) => ({
    url: route === "/" ? `${SITE_URL}/` : `${SITE_URL}${route}`,
    changeFrequency: "monthly" as const,
    // The landing is the entry point; everything else sits a step below it.
    priority: route === "/" ? 1 : 0.8,
  }));

  // Blog: the index plus every published article. A real lastModified here
  // (content time, not build time) is honest — unlike the marketing pages, a
  // post genuinely changes when it is edited.
  routes.push({ url: `${SITE_URL}/blog`, changeFrequency: "weekly", priority: 0.7 });
  try {
    const posts = await publicCaller.blog.sitemap();
    for (const p of posts) {
      routes.push({
        url: `${SITE_URL}/blog/${p.slug}`,
        changeFrequency: "monthly",
        priority: 0.6,
        ...(p.lastModified ? { lastModified: new Date(p.lastModified) } : {}),
      });
    }
  } catch {
    // DB unreachable at build — ship the static routes rather than fail the map.
  }
  return routes;
}
