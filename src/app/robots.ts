import type { MetadataRoute } from "next";
import { PRIVATE_ROUTES, SITE_URL } from "@/lib/site";

/**
 * Serves /robots.txt. Before this existed the path 404'd, so crawlers had no
 * pointer to the sitemap and no signal about which routes are members-only.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Trailing slashes so `/map` also covers `/map/anything`.
      disallow: [...PRIVATE_ROUTES.map((route) => `${route}/`), "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
