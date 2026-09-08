import Link from "next/link";
import { BlogSiteHeader } from "@/features/blog/blog-site-header";
import { SITE_NAME } from "@/lib/site";

/**
 * Shared frame for every blog page: a header with the way back to the site
 * and the app, the page, and a short footer. Pages inside stay static — the
 * only client piece is the header's session check.
 */
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <BlogSiteHeader />
      <div className="flex-1">{children}</div>
      <footer className="border-border/70 mt-8 border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-6xl 2xl:max-w-7xl flex-col gap-3 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>{SITE_NAME} — giữ lại những chuyến đi của bạn. Làm tại Việt Nam.</p>
          <nav aria-label="Liên kết" className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/" className="hover:text-accent">Trang chủ</Link>
            <Link href="/tinh-nang" className="hover:text-accent">Tính năng</Link>
            <Link href="/blog" className="hover:text-accent">Blog</Link>
            <Link href="/home" className="hover:text-accent">Mở ứng dụng</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
