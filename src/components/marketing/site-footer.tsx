import Link from "next/link";
import { BrandMark } from "@/components/layout/brand-mark";
import { READING_PATH } from "@/features/blog/reading-path";
import { SITE_NAME } from "@/lib/site";

/**
 * The footer for the whole public site — landing, the feature hub, the four
 * feature pages and the blog.
 *
 * Deliberately the ONE dark band on the site. The first version was a pale
 * cream panel on a cream page: it carried links but read as another content
 * section, and on the blog it disappeared into the backdrop artwork entirely.
 * A footer's first job is to say "the page ends here", and a change of ground
 * does that before a single word is read.
 *
 * Palette is the page's own ink, darkened (#2e2721), with the terracotta
 * lifted to #e69365 — the brand's #c2693f is too dark on this ground to pass
 * contrast at 13px. Hard-coded rather than themed on purpose: this is the
 * site's footer, not the couple's space, so it must look the same to every
 * visitor whatever accent preset their space uses.
 *
 * Type: the brand name in Baloo 2 (--font-display, the rounded face the logo
 * itself is drawn in) so the block is signed rather than labelled; everything
 * else in Inter, with the column headings small, uppercase and letter-spaced
 * so they read as headings at 11px without needing weight or colour.
 */

const COLUMNS: Array<{ heading: string; links: Array<{ href: string; label: string }> }> = [
  {
    heading: "Sản phẩm",
    links: [
      { href: "/tinh-nang", label: "Tất cả tính năng" },
      { href: "/luu-dia-diem-da-di", label: "Bản đồ nơi đã đi" },
      { href: "/hom-nay-an-gi", label: "Hôm nay ăn gì" },
      { href: "/nhat-ky-du-lich", label: "Nhật ký du lịch" },
      { href: "/thu-gui-tuong-lai", label: "Thư gửi tương lai" },
    ],
  },
  {
    heading: "Tài khoản",
    links: [
      { href: "/home", label: "Mở ứng dụng" },
      { href: "/sign-in", label: "Đăng nhập" },
      { href: "/sign-up", label: "Tạo tài khoản" },
      { href: "/blog/tim-kiem", label: "Tìm bài viết" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative bg-[#2e2721] text-[#e8dfd2]">
      {/* The seam. A hairline of the brand colour reads as a deliberate edge
          where a plain border would read as a table rule. */}
      <div aria-hidden="true" className="h-px w-full bg-gradient-to-r from-transparent via-[#c2693f]/60 to-transparent" />

      {/* Two columns of links on a phone. Stacked one per row the footer ran
          past two screens; the brand block and the numbered path take the full
          width, the two short lists share a row. */}
      <div className="mx-auto grid max-w-6xl grid-cols-2 2xl:max-w-7xl gap-x-6 gap-y-9 px-6 pb-10 pt-14 sm:pt-16 lg:grid-cols-[1.5fr_1fr_1fr_1.15fr] lg:gap-12">
        {/* Brand block: the logo, signed with the brand face. */}
        <div className="col-span-2 lg:col-span-1">
          <Link href="/" className="inline-flex items-center gap-3 transition-opacity hover:opacity-80">
            <BrandMark variant="icon" className="h-11 w-11 shrink-0" />
            <span
              className="text-xl font-bold leading-none text-[#f3ece1]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {SITE_NAME}
            </span>
          </Link>
          <p
            className="mt-5 max-w-xs text-[15.5px] leading-relaxed text-[#c0b4a4]"
            style={{ fontFamily: "var(--font-letter)" }}
          >
            Một góc riêng để giữ lại những chỗ đã đi, món đã ăn, những hôm đáng nhớ — và lên kế hoạch cho lần tới.
          </p>
          <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-[#8f857a]">
            <span>Miễn phí</span>
            <span aria-hidden="true">·</span>
            <span>Không quảng cáo</span>
            <span aria-hidden="true">·</span>
            <span>Không cần tải app</span>
          </p>
        </div>

        {COLUMNS.map((col) => (
          <nav key={col.heading} aria-label={col.heading}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e69365]">{col.heading}</p>
            <ul className="mt-4 space-y-2.5 text-[15px] font-light text-[#b3a798]">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition-colors hover:text-[#f3ece1]">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        {/* The guided path, numbered — the order is the information here. */}
        <nav aria-label="Bắt đầu từ đây" className="col-span-2 lg:col-span-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e69365]">Bắt đầu từ đây</p>
          <ol className="mt-4 space-y-2.5 text-[15px] font-light text-[#b3a798]">
            {READING_PATH.slice(0, 4).map((s, i) => (
              <li key={s.slug}>
                <Link href={`/blog/${s.slug}`} className="group inline-flex gap-2 transition-colors hover:text-[#f3ece1]">
                  <span className="tabular-nums text-[#6f665c] transition-colors group-hover:text-[#e69365]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s.step}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/blog" className="text-[#e69365] transition-opacity hover:opacity-75">
                Tất cả bài viết →
              </Link>
            </li>
          </ol>
        </nav>
      </div>

      {/* Bottom bar. Short, factual, and the one line worth repeating. */}
      <div className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-6xl flex-col 2xl:max-w-7xl gap-2 px-6 py-6 text-[13px] text-[#8f857a] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE_NAME} — làm tại Việt Nam.
          </p>
          <p>
            Bản đồ trong app ghi{" "}
            <Link href="/blog/ban-do-viet-nam-hoang-sa-truong-sa" className="text-[#c9bdae] underline decoration-[#e69365]/40 underline-offset-2 transition-colors hover:text-[#f3ece1] hover:decoration-[#e69365]">
              Hoàng Sa, Trường Sa là của Việt Nam
            </Link>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
