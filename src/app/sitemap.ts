import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { FEATURE_PAGES } from "@/components/marketing/feature-pages";

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
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      changeFrequency: "monthly",
      priority: 1,
    },
    ...FEATURE_PAGES.map((page) => ({
      url: `${SITE_URL}/${page.slug}`,
      changeFrequency: "monthly" as const,
      // Below the homepage, level with each other. Priority is a weak hint at
      // best; what matters is that they are listed at all.
      priority: 0.8,
    })),
  ];
}
