import Link from "next/link";
import { READING_PATH } from "@/features/blog/reading-path";
import { SITE_NAME } from "@/lib/site";

/**
 * The site map, shared by every marketing page — landing, the feature hub and
 * the four feature pages. One line with two links was the whole footer on all
 * of them; a first-time visitor who scrolled to the end had nowhere to go.
 * Parchment palette, like the pages it closes.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-[#d8cfc1]/60 bg-[#f6f0e7]">
      <div className="mx-auto max-w-5xl px-6 pb-8 pt-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <p className="text-lg font-medium text-[#3b322a]">{SITE_NAME}</p>
            <p className="mt-3 max-w-xs text-[15px] font-light leading-relaxed text-[#6b5c51]">
              Một góc riêng để giữ lại những chỗ đã đi, món đã ăn, những hôm đáng nhớ — và lên kế hoạch cho lần tới. Miễn phí, không quảng cáo, không cần tải app.
            </p>
            <Link
              href="/sign-up"
              className="mt-6 inline-flex h-11 items-center rounded-full bg-[#c2693f] px-5 text-[15px] font-medium text-white transition-colors hover:bg-[#a8542f]"
            >
              Tạo tài khoản
            </Link>
          </div>
          <nav aria-label="Sản phẩm">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#a8542f]">Sản phẩm</p>
            <ul className="mt-4 space-y-2.5 text-[15px] font-light text-[#6b5c51]">
              <li><Link href="/tinh-nang" className="transition-colors hover:text-[#a8542f]">Tất cả tính năng</Link></li>
              <li><Link href="/luu-dia-diem-da-di" className="transition-colors hover:text-[#a8542f]">Bản đồ nơi đã đi</Link></li>
              <li><Link href="/hom-nay-an-gi" className="transition-colors hover:text-[#a8542f]">Hôm nay ăn gì</Link></li>
              <li><Link href="/nhat-ky-du-lich" className="transition-colors hover:text-[#a8542f]">Nhật ký du lịch</Link></li>
              <li><Link href="/thu-gui-tuong-lai" className="transition-colors hover:text-[#a8542f]">Thư gửi tương lai</Link></li>
            </ul>
          </nav>
          <nav aria-label="Hướng dẫn">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#a8542f]">Bắt đầu từ đây</p>
            <ul className="mt-4 space-y-2.5 text-[15px] font-light text-[#6b5c51]">
              {READING_PATH.slice(0, 4).map((s, i) => (
                <li key={s.slug}>
                  <Link href={`/blog/${s.slug}`} className="transition-colors hover:text-[#a8542f]">
                    <span className="mr-1.5 tabular-nums text-[#c2693f]/70">{i + 1}.</span>
                    {s.step}
                  </Link>
                </li>
              ))}
              <li><Link href="/blog" className="font-medium text-[#a8542f] transition-opacity hover:opacity-70">Tất cả bài viết →</Link></li>
            </ul>
          </nav>
          <nav aria-label="Tài khoản">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#a8542f]">Tài khoản</p>
            <ul className="mt-4 space-y-2.5 text-[15px] font-light text-[#6b5c51]">
              <li><Link href="/sign-in" className="transition-colors hover:text-[#a8542f]">Đăng nhập</Link></li>
              <li><Link href="/sign-up" className="transition-colors hover:text-[#a8542f]">Tạo tài khoản</Link></li>
              <li><Link href="/home" className="transition-colors hover:text-[#a8542f]">Mở ứng dụng</Link></li>
              <li><a href="#top" className="transition-colors hover:text-[#a8542f]">Lên đầu trang</a></li>
            </ul>
          </nav>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-[#d8cfc1]/60 pt-6 text-sm font-light text-[#7a6d60] sm:flex-row sm:items-center sm:justify-between">
          <p>{SITE_NAME} — làm tại Việt Nam.</p>
          <p>
            Bản đồ trong app ghi{" "}
            <Link href="/blog/ban-do-viet-nam-hoang-sa-truong-sa" className="text-[#a8542f] transition-opacity hover:opacity-70">
              Hoàng Sa, Trường Sa là của Việt Nam
            </Link>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
