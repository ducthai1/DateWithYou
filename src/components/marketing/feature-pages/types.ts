import type { FaqItem } from "../landing-content";

/**
 * Shape of a standalone feature page.
 *
 * Google ranks pages, not sites. The landing page was trying to be the best
 * answer for "hôm nay ăn gì" and "nhật ký du lịch" and "thư gửi tương lai" at
 * once, which means it was the best answer for none of them — one page gets one
 * dominant topic and the rest dilute it. Each page below owns exactly one
 * intent.
 *
 * The fields are deliberately loose (`sections` is an array of whatever each
 * page needs) rather than a fixed template of hero/problem/solution slots. A
 * rigid template is how this technique fails: four pages with the same skeleton
 * and swapped keywords are doorway pages, which Google penalises site-wide, not
 * just on the offending pages. Each page here argues its own case in its own
 * order.
 */
export interface FeaturePageSection {
  heading: string;
  /** Prose. Kept as separate strings so each renders as its own <p>. */
  paragraphs?: string[];
  /** Optional list, for pages where the point is genuinely enumerable. */
  items?: { label: string; body: string }[];
  /**
   * Optional artwork for this one section, rendered as a two-column band
   * instead of the plain full-width prose block. These pages exist to be
   * read — see the file comment on FeaturePageShell — so this is deliberately
   * per-section and optional rather than a slot every section fills. Reach
   * for it on a section whose point a picture actually restates, not on
   * every section, or the page stops being an argument and starts being a
   * slideshow with captions.
   */
  art?: FeaturePageArt;
}

/** Artwork shown under the tagline, or on one section. Keyed into the tone registry. */
export type FeaturePageArt =
  | "wheelFood"
  | "mapIsland"
  | "memoriesScrapbook"
  | "vaultSafe"
  | "tripPlanner"
  | "calendarTablet";

export interface RelatedLink {
  href: string;
  label: string;
  blurb: string;
}

export interface FeaturePage {
  /** URL segment, also the canonical path. */
  slug: string;
  /** <title>. Written as the query someone types, not as a feature name. */
  metaTitle: string;
  metaDescription: string;
  /** Visible page heading — may differ from metaTitle, which carries keywords. */
  h1: string;
  eyebrow: string;
  /** One line under the h1. */
  tagline: string;
  /** Artwork under the tagline. Omit on a page where a picture adds nothing. */
  art?: FeaturePageArt;
  sections: FeaturePageSection[];
  /** Page-specific FAQ. Mirrored verbatim into this page's FAQPage JSON-LD. */
  faq: FaqItem[];
  cta: { heading: string; body: string; label: string };
  /**
   * Links to the sibling pages. Without these the new pages are orphans:
   * nothing points at them, so nothing flows to them and Google has a harder
   * time justifying a crawl.
   */
  related: RelatedLink[];
}
