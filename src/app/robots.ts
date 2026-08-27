import type { MetadataRoute } from "next";
import { PRIVATE_ROUTES, SITE_URL } from "@/lib/site";
import { MARKETING_ROUTES } from "@/components/marketing/feature-pages/slugs";

/**
 * Serves /robots.txt. Before this existed the path 404'd, so crawlers had no
 * pointer to the sitemap and no signal about which routes are members-only.
 */

/**
 * Fails the build if a publicly indexable route would be swallowed by one of
 * the Disallow prefixes. Cheap insurance: a new marketing page whose slug
 * happens to start with a private route name would be silently de-indexed, and
 * the only symptom would be traffic that never arrives.
 */
function assertPublicRoutesAreCrawlable() {
  const publicRoutes = MARKETING_ROUTES;
  for (const route of publicRoutes) {
    const blockedBy = PRIVATE_ROUTES.find(
      (priv) => route !== "/" && route.startsWith(priv),
    );
    if (blockedBy) {
      throw new Error(
        `robots.txt would block the public route ${route} via "${blockedBy}". ` +
          `Rename the route or narrow the disallow rule.`,
      );
    }
  }
}

export default function robots(): MetadataRoute.Robots {
  assertPublicRoutesAreCrawlable();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      /*
       * No trailing slash. robots.txt matching is a plain prefix test, so
       * "Disallow: /map/" covers /map/anything but NOT /map itself — which is
       * the actual page. The earlier version appended a slash believing it
       * widened the rule; it narrows it, and left every members-only route
       * advertised as crawlable.
       *
       * A bare prefix does mean a route is blocked by any private route it
       * starts with. That is checked at build time below rather than trusted,
       * because the margin is thinner than it looks: /home and /hom-nay-an-gi
       * share three characters.
       */
      disallow: [...PRIVATE_ROUTES, "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
