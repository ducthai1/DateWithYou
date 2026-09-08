import { BlogSiteHeader } from "@/features/blog/blog-site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

/**
 * Shared frame for every blog page: a header with the way back to the site and
 * the app, the page, and the site footer — the same one the landing and the
 * feature pages close with, so the public site ends the same way everywhere.
 * Pages inside stay static; the only client piece is the header's session check.
 */
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <BlogSiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
