import type { Metadata } from "next";
import { LandingHero } from "@/components/marketing/landing-hero";
import { LandingSections } from "@/components/marketing/landing-sections";
import { SectionRail } from "@/components/marketing/section-rail";
import { FAQ } from "@/components/marketing/landing-content";
import {
  SITE_ALTERNATE_NAMES,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site";

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
    /*
     * siteName has to be repeated for the same reason images does — and was
     * missed for the same reason. A page-level openGraph REPLACES the layout's
     * object rather than merging, so og:site_name never reached the homepage:
     * the one page a search engine reads a site name from. With no site name
     * declared, Google fell back to naming the site after the domain owner and
     * displayed "Vercel".
     */
    siteName: SITE_NAME,
    url: "/",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: "/og-card.jpg", width: 1200, height: 630, alt: SITE_TITLE }],
  },
};

/**
 * Structured data. Four nodes, each answering a different question:
 *  - WebSite, which is where a search engine reads the site's NAME from.
 *  - WebApplication, so the brand query "Vivu No Plan" can resolve to a rich
 *    result instead of a plain blue link.
 *  - Organization, which carries the logo.
 *  - FAQPage, built from the exact same array the visible accordion renders.
 */
function StructuredData() {
  const graph = [
    {
      /*
       * The node Google actually takes a site name from. WebApplication cannot
       * stand in for it — that is a SoftwareApplication, not a subtype of
       * WebSite — and Organization serves the knowledge panel and the logo
       * instead. With neither declared, the fallback is the domain owner's
       * name, which on a *.vercel.app subdomain reads as "Vercel".
       */
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      alternateName: SITE_ALTERNATE_NAMES,
      url: `${SITE_URL}/`,
      inLanguage: "vi-VN",
      publisher: { "@id": `${SITE_URL}/#org` },
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web",
      inLanguage: "vi-VN",
      alternateName: SITE_ALTERNATE_NAMES,
      // Stated explicitly because the copy used to imply couples only.
      audience: {
        "@type": "Audience",
        audienceType:
          "Người đi chơi một mình, bạn thân, anh chị em, bạn cùng phòng, bạn đồng hành, cặp đôi",
      },
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
      /*
       * The spellings people actually type. `alternateName` is the supported
       * way to tell a search engine that several strings mean one brand — a
       * keywords meta tag is not; Google stopped reading that in 2009.
       */
      alternateName: SITE_ALTERNATE_NAMES,
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
        No manual <link rel="preload"> here anymore. It used to hand-match a
        breakpoint to the old hero's <picture> because the browser's preload
        scanner cannot see into a component tree on its own. The new hero's
        artwork renders through <ToneArt priority>, which is next/image with
        `priority` — Next emits its own preload for that, already pointed at
        the resolved, tone-correct file. A manual link here would have to
        guess the tone and would just add a second, unused fetch.
      */}
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
