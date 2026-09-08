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
      {/* On the card colour, with a border: the text used to sit straight on the
          backdrop artwork and disappeared into it. */}
      <footer className="border-border/70 bg-card/95 mt-10 border-t backdrop-blur-sm">
        <div className="mx-auto w-full max-w-6xl 2xl:max-w-7xl px-4 py-10">
          <div className="grid gap-8 sm:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <p className="text-foreground font-semibold">{SITE_NAME}</p>
              <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
                Giữ lại những chuyến đi của bạn: bản đồ nơi đã đi, lịch chung, dòng kỷ niệm, chuyến đi và một chiếc két bí mật. Miễn phí, không quảng cáo.
              </p>
            </div>
            <nav aria-label="Trang" className="text-sm">
              <p className="text-accent text-xs font-semibold uppercase tracking-wide">Trang</p>
              <ul className="text-muted-foreground mt-3 space-y-2">
                <li><Link href="/" className="hover:text-accent">Trang chủ</Link></li>
                <li><Link href="/tinh-nang" className="hover:text-accent">Tính năng</Link></li>
                <li><Link href="/blog" className="hover:text-accent">Blog</Link></li>
                <li><Link href="/blog/tim-kiem" className="hover:text-accent">Tìm bài viết</Link></li>
              </ul>
            </nav>
            <nav aria-label="Tài khoản" className="text-sm">
              <p className="text-accent text-xs font-semibold uppercase tracking-wide">Tài khoản</p>
              <ul className="text-muted-foreground mt-3 space-y-2">
                <li><Link href="/home" className="hover:text-accent">Mở ứng dụng</Link></li>
                <li><Link href="/sign-in" className="hover:text-accent">Đăng nhập</Link></li>
                <li><Link href="/sign-up" className="hover:text-accent">Tạo tài khoản</Link></li>
              </ul>
            </nav>
          </div>
          <p className="text-muted-foreground border-border/70 mt-8 border-t pt-5 text-xs">
            {SITE_NAME} — làm tại Việt Nam. Bản đồ trong app ghi{" "}
            <Link href="/blog/ban-do-viet-nam-hoang-sa-truong-sa" className="text-accent hover:underline">Hoàng Sa, Trường Sa là của Việt Nam</Link>.
          </p>
        </div>
      </footer>
    </div>
  );
}
