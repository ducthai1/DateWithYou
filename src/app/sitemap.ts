import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Serves /sitemap.xml.
 *
 * Deliberately a single entry. Everything else is either behind auth or a thin
 * auth screen; listing those would submit pages we also mark noindex, which
 * reads as a contradictory signal. One page that is genuinely indexable beats
 * a long list that mostly is not.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
