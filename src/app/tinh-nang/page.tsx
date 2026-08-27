import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/marketing/reveal";
import { FEATURE_PAGES } from "@/components/marketing/feature-pages";
import { FeatureHubGrid } from "@/components/marketing/feature-hub-grid";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

/*
 * The hub for the feature pages.
 *
 * Those four pages existed for a while with no way to reach them except a
 * "Xem chi tiết" link buried on one card each, halfway down the landing page.
 * That is bad for a reader who wants to browse them, and bad for a crawler:
 * a page reachable by exactly one link from one place looks like an
 * afterthought, and there was no single URL that said "here is all of it".
 *
 * This is also the page to point at from anywhere that needs one link rather
 * than four — a bio, a message, a directory listing.
 */

const TITLE = "Tính năng — Vivu No Plan làm được những gì";
const DESCRIPTION =
  "Bốn thứ dùng nhiều nhất, mỗi thứ một trang nói kỹ: vòng quay chọn quán, bản đồ nơi đã đi, nhật ký du lịch và hộp thời gian. Miễn phí, chạy trên trình duyệt.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/tinh-nang" },
  openGraph: {
    type: "website",
    // Repeated because a page-level openGraph replaces the layout's object
    // rather than merging — this has cost og:image and og:site_name before.
    siteName: SITE_NAME,
    url: "/tinh-nang",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/og-card.jpg", width: 1200, height: 630, alt: TITLE }],
  },
};

function StructuredData() {
  const url = `${SITE_URL}/tinh-nang`;
  const graph = [
    {
      "@type": "CollectionPage",
      "@id": `${url}#webpage`,
      url,
      name: TITLE,
      description: DESCRIPTION,
      inLanguage: "vi-VN",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#app` },
    },
    {
      // Names the four pages as one set, which is the thing that was missing:
      // previously nothing told a crawler these belonged together.
      "@type": "ItemList",
      "@id": `${url}#list`,
      itemListOrder: "https://schema.org/ItemListUnordered",
      numberOfItems: FEATURE_PAGES.length,
      itemListElement: FEATURE_PAGES.map((page, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: page.h1,
        description: page.metaDescription,
        url: `${SITE_URL}/${page.slug}`,
      })),
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Tính năng", item: url },
      ],
    },
  ];
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
      }}
    />
  );
}

export default function Page() {
  return (
    <>
      <StructuredData />
      <div className="relative min-h-dvh bg-[#fdfaf6] text-[#3b322a]">
        {/* Wider than the reading pages on purpose. Long-form prose wants a
            narrow measure; a grid of parallel tiles wants the screen. At
            max-w-4xl this page left ~350px of dead margin each side on a
            1600px display and read as an unfinished document. */}
        <div className="mx-auto max-w-6xl px-6 pt-12 pb-20 sm:px-8 sm:pt-16 sm:pb-28">
          <Reveal>
            <Link
              href="/"
              className="-my-2 inline-flex items-center gap-1.5 py-2 text-sm font-light text-[#8a7c6f] transition-colors hover:text-[#a8542f]"
            >
              <span aria-hidden="true">←</span> {SITE_NAME}
            </Link>
          </Reveal>

          {/* Hero spans the full width in two columns rather than stacking in a
              narrow centred stack, which is what left the sides empty. */}
          <Reveal delay={80}>
            <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-end lg:gap-14">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#a8542f]">
                  Tính năng
                </p>
                <h1 className="mt-4 text-[2.15rem] font-medium leading-[1.1] tracking-tight sm:text-[3rem]">
                  Vivu No Plan làm được những gì
                </h1>
              </div>
              <p className="text-[17px] font-light leading-relaxed text-[#6b5c51] lg:pb-2">
                {SITE_DESCRIPTION}
              </p>
            </div>
          </Reveal>

          {/* Three facts, not decoration — each is a real property of the
              product and each answers an objection someone has before they
              click anything. */}
          <Reveal delay={140}>
            <dl className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-[#d8cfc1]/70 bg-[#d8cfc1]/70 sm:grid-cols-3">
              {[
                ["Miễn phí", "Không giới hạn thời gian, không quảng cáo, không cần thẻ."],
                ["Không cần tải app", "Chạy thẳng trên trình duyệt, thêm vào màn hình chính nếu muốn."],
                ["Riêng tư", "Không bảng tin, không người lạ, không thuật toán gợi ý."],
              ].map(([term, detail]) => (
                <div key={term} className="bg-[#fdfaf6] px-6 py-5">
                  <dt className="text-[15px] font-medium text-[#3b322a]">{term}</dt>
                  <dd className="mt-1.5 text-[13.5px] font-light leading-relaxed text-[#7a6d60]">
                    {detail}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <div className="mt-12">
            <FeatureHubGrid />
          </div>

          <Reveal as="section">
            <div className="mt-14 overflow-hidden rounded-[28px] bg-[#021617] px-8 py-12 text-center sm:px-12 sm:py-14">
              <h2 className="text-2xl font-medium tracking-tight text-white sm:text-[1.85rem]">
                Mở góc riêng của bạn
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[15px] font-light leading-relaxed text-[#BFD9DE]">
                Mất chừng một phút để tạo xong, và bạn không cần rủ ai để bắt đầu.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
                <Link
                  href="/sign-up"
                  className="flex h-14 w-full max-w-xs items-center justify-center rounded-full bg-[#c2693f] text-[17px] font-medium tracking-wide text-white shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition-all hover:-translate-y-0.5 hover:bg-[#a8542f] active:translate-y-0 active:scale-[0.98]"
                >
                  Tạo tài khoản
                </Link>
                <Link
                  href="/sign-in"
                  className="flex h-14 w-full max-w-xs items-center justify-center rounded-full border border-white/20 text-[17px] font-medium tracking-wide text-white/90 transition-colors hover:border-white/40 hover:text-white"
                >
                  Đã có tài khoản
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </>
  );
}
