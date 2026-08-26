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
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    },
    ...FEATURE_PAGES.map((page) => ({
      url: `${SITE_URL}/${page.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      // Below the homepage, level with each other. Priority is a weak hint at
      // best; what matters is that they are listed at all.
      priority: 0.8,
    })),
  ];
}
