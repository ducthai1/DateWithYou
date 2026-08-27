import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/marketing/reveal";
import { FEATURE_PAGES } from "@/components/marketing/feature-pages";
import { FEATURE_PAGE_APP_HREF } from "@/components/marketing/feature-pages";
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
        <div className="mx-auto max-w-4xl px-6 pt-14 pb-20 sm:pt-20 sm:pb-28">
          <Reveal>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-light text-[#8a7c6f] transition-colors hover:text-[#a8542f]"
            >
              <span aria-hidden="true">←</span> {SITE_NAME}
            </Link>
          </Reveal>

          <Reveal delay={90}>
            <p className="mt-10 text-xs font-medium uppercase tracking-[0.2em] text-[#a8542f]">
              Tính năng
            </p>
            <h1 className="mt-4 max-w-2xl text-[2rem] font-medium leading-[1.15] tracking-tight sm:text-[2.75rem]">
              Vivu No Plan làm được những gì
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-light leading-relaxed text-[#6b5c51]">
              {SITE_DESCRIPTION}
            </p>
          </Reveal>

          <ul className="mt-14 grid gap-5 sm:grid-cols-2">
            {FEATURE_PAGES.map((page, i) => (
              <Reveal as="li" key={page.slug} delay={Math.min(i, 3) * 110}>
                <Link
                  href={`/${page.slug}`}
                  className="group flex h-full flex-col rounded-3xl border border-[#d8cfc1]/70 bg-white/50 p-7 transition-colors hover:border-[#c2693f]/40 hover:bg-white/80"
                >
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-[#a8542f]">
                    {page.eyebrow}
                  </span>
                  <h2 className="mt-4 text-xl font-medium leading-snug group-hover:text-[#a8542f]">
                    {page.h1}
                  </h2>
                  <p className="mt-3 flex-1 text-[15px] font-light leading-relaxed text-[#6b5c51]">
                    {page.tagline}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1 text-[13px] font-medium text-[#a8542f]">
                    Đọc tiếp <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>

          {/* Direct links into the app for anyone already signed in — the four
              pages above are for reading, these are for doing. */}
          <Reveal as="nav">
            <div className="mt-14 border-t border-[#d8cfc1]/60 pt-10">
              <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-[#a8542f]">
                Mở thẳng trong ứng dụng
              </h2>
              <ul className="mt-5 flex flex-wrap gap-2.5">
                {FEATURE_PAGES.map((page) => {
                  const href = FEATURE_PAGE_APP_HREF[page.slug];
                  return href ? (
                    <li key={page.slug}>
                      <Link
                        href={href}
                        className="inline-flex rounded-full border border-[#d8cfc1]/80 bg-white/50 px-4 py-2 text-[14px] font-light text-[#6b5c51] transition-colors hover:border-[#c2693f]/40 hover:text-[#a8542f]"
                      >
                        {page.cta.label}
                      </Link>
                    </li>
                  ) : null;
                })}
              </ul>
            </div>
          </Reveal>

          <Reveal as="section">
            <div className="mt-14 border-t border-[#d8cfc1]/60 pt-10 text-center">
              <Link
                href="/sign-up"
                className="inline-flex h-14 w-full max-w-xs items-center justify-center rounded-full bg-[#c2693f] text-[17px] font-medium tracking-wide text-white shadow-[0_8px_20px_rgba(194,105,63,0.25)] transition-all hover:-translate-y-0.5 hover:bg-[#a8542f] active:translate-y-0 active:scale-[0.98]"
              >
                Tạo tài khoản
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </>
  );
}
