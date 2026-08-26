import type { Metadata } from "next";
import { LandingHero } from "@/components/marketing/landing-hero";
import { LandingSections } from "@/components/marketing/landing-sections";
import { SectionRail } from "@/components/marketing/section-rail";
import { FAQ } from "@/components/marketing/landing-content";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";

/*
 * The only publicly indexable route. It is a Server Component so it can export
 * metadata and emit JSON-LD — the previous version was "use client", which
 * silently forfeits both.
 */
export const metadata: Metadata = {
  title: {
    absolute: SITE_TITLE,
  },
  description: SITE_DESCRIPTION,
  alternates: {
    // Self-referencing canonical. The app answers on more than one host
    // (the vercel.app domain plus any custom domain later), and without this
    // those read as duplicate pages competing with each other.
    canonical: "/",
  },
  /*
   * `images` has to be repeated here. A page-level `openGraph` REPLACES the
   * layout's whole openGraph object rather than merging into it, so omitting
   * the image drops og:image from the one page that actually gets shared.
   * (twitter is not overridden here, which is why it kept its image and this
   * was easy to miss.)
   */
  openGraph: {
    type: "website",
    url: "/",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: "/og-card.jpg", width: 1200, height: 630, alt: SITE_TITLE }],
  },
};

/**
 * Structured data. Two graphs:
 *  - WebApplication, so the brand query "Vivu No Plan" can resolve to a rich
 *    result instead of a plain blue link.
 *  - FAQPage, built from the exact same array the visible accordion renders.
 */
function StructuredData() {
  const graph = [
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web",
      inLanguage: "vi-VN",
      // Without an image here the graph gives Google nothing to attach to the
      // result; og:image is read by link unfurlers, not by Search.
      image: `${SITE_URL}/og-card.jpg`,
      publisher: { "@id": `${SITE_URL}/#org` },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "VND",
      },
    },
    {
      // Carries the site logo. Google reads `logo` off an Organization node,
      // not off the application node, so the two are declared separately and
      // linked by @id.
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon-512.png`,
        width: 512,
        height: 512,
      },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: FAQ.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ];

  return (
    <script
      type="application/ld+json"
      // Serialised through JSON.stringify, and every value is our own copy —
      // no user input reaches this string.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
      }}
    />
  );
}

export default function Home() {
  return (
    <>
      {/*
        Preload the hero artwork, matched to the same breakpoint the <picture>
        uses so only one file is ever fetched. Without this the browser did not
        discover the LCP image until ~1s after the document arrived, because it
        sits inside a client component well past the render-blocking font CSS.
        React hoists these into <head>.
      */}
      <link
        rel="preload"
        as="image"
        href="/hero-logo-tight.webp"
        media="(max-width: 767px)"
        fetchPriority="high"
      />
      <link
        rel="preload"
        as="image"
        href="/hero-logo.webp"
        media="(min-width: 768px)"
        fetchPriority="high"
      />
      <StructuredData />
      {/* Anchor for the back-to-top link. An id beats scrollTo(0) here: it
          inherits the page's smooth scroll-behavior and works without JS. */}
      <span id="top" />
      {/*
        `.landing-root` is what scopes smooth scrolling to this route (globals
        keys off html:has(.landing-root)) and what the section rail uses to find
        the hero for its sentinel. Both would otherwise need a client hook just
        to know which page they are on.
      */}
      <div className="landing-root">
        <LandingHero />
        <LandingSections />
      </div>
      <SectionRail />
    </>
  );
}
