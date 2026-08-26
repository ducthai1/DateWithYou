import type { Metadata } from "next";
import type { FeaturePage } from "./feature-pages";
import { FEATURE_PAGE_OG_IMAGE } from "./feature-pages";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * Metadata for a feature page.
 *
 * `openGraph` repeats siteName and images on purpose. A page-level openGraph
 * REPLACES the layout's object instead of merging into it, and this project has
 * already lost og:image once and og:site_name once to exactly that — the second
 * time costing a SERP that read "Vercel" instead of the site's name. Any field
 * the layout sets and this page needs has to be written again here.
 */
export function buildFeaturePageMetadata(page: FeaturePage): Metadata {
  const url = `/${page.slug}`;
  const image = FEATURE_PAGE_OG_IMAGE[page.slug] ?? "/og-card.jpg";

  return {
    title: { absolute: `${page.metaTitle} | ${SITE_NAME}` },
    description: page.metaDescription,
    // Self-referencing canonical: the app answers on more than one host, and
    // without this those read as duplicates competing with each other.
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      url,
      title: page.metaTitle,
      description: page.metaDescription,
      images: [{ url: image, width: 1200, height: 630, alt: page.metaTitle }],
    },
  };
}

/**
 * Structured data for a feature page. Three nodes:
 *
 *  - WebPage, tied back to the homepage's WebSite node by @id so the four pages
 *    read as one site rather than four unrelated documents.
 *  - BreadcrumbList, which is what lets Google print "vivu-noplan.vercel.app ›
 *    Hôm nay ăn gì" instead of a bare URL.
 *  - FAQPage, built from the same array the visible accordion renders. Built
 *    from one source because structured data that disagrees with the visible
 *    page is a spam signal, not a bonus.
 */
export function FeaturePageStructuredData({ page }: { page: FeaturePage }) {
  const pageUrl = `${SITE_URL}/${page.slug}`;

  const graph = [
    {
      "@type": "WebPage",
      "@id": `${pageUrl}#webpage`,
      url: pageUrl,
      name: page.metaTitle,
      description: page.metaDescription,
      inLanguage: "vi-VN",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      publisher: { "@id": `${SITE_URL}/#org` },
      about: { "@id": `${SITE_URL}/#app` },
      primaryImageOfPage: `${SITE_URL}${FEATURE_PAGE_OG_IMAGE[page.slug] ?? "/og-card.jpg"}`,
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${pageUrl}#breadcrumb`,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: SITE_NAME,
          item: `${SITE_URL}/`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: page.h1,
          item: pageUrl,
        },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${pageUrl}#faq`,
      mainEntity: page.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ];

  return (
    <script
      type="application/ld+json"
      // JSON.stringify over our own copy only — no user input reaches this.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
      }}
    />
  );
}
