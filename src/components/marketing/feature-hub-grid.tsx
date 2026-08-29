import Link from "next/link";
import { ToneArt } from "@/components/theme/tone-art";
import { Reveal } from "./reveal";
import { FEATURE_PAGES, FEATURE_PAGE_STYLE, FEATURE_PAGE_APP_HREF } from "./feature-pages";

/*
 * The hub's bento grid.
 *
 * What this replaces was a two-column card list inside max-w-4xl. On a 1600px
 * screen that left roughly 350px of dead margin down each side and produced a
 * page made entirely of text and hairline borders — it read as a document, not
 * as a product page, and the wide space made it look unfinished rather than
 * calm.
 *
 * A bento grid is the right pattern specifically because these four features
 * carry similar weight. The usual failure of bento is applying it to a product
 * with one dominant proposition that should lead; that is not this page. Tile
 * size does the ranking here — the wheel and the map get the wide cells because
 * they are the two people reach for most — so the layout states the hierarchy
 * without labelling it.
 *
 * Sizing is deliberate: fewer, larger cells rather than more content crammed
 * in. The extra width buys breathing room, not more words.
 */

/** Which cells get the wide slot on a three-column grid. */
const WIDE = new Set(["hom-nay-an-gi", "nhat-ky-du-lich"]);

export function FeatureHubGrid() {
  return (
    <ul className="grid gap-4 sm:gap-5 lg:grid-cols-3">
      {FEATURE_PAGES.map((page, i) => {
        const style = FEATURE_PAGE_STYLE[page.slug];
        const wide = WIDE.has(page.slug);
        const appHref = FEATURE_PAGE_APP_HREF[page.slug];
        return (
          <Reveal
            as="li"
            key={page.slug}
            delay={Math.min(i, 3) * 90}
            className={wide ? "lg:col-span-2" : ""}
          >
            <div className="group relative flex h-full flex-col overflow-hidden rounded-[28px] border border-[#d8cfc1]/70 bg-white/60 transition-colors hover:border-[#c2693f]/40 hover:bg-white/90">
              {/* A strip of the page's own artwork above the tint band. The
                  tiles were colour and text only; this is what the page is
                  actually about, and it is the same picture the page leads
                  with, so the tile and the page introduce each other. */}
              {page.art ? (
                <div className={`relative overflow-hidden ${wide ? "h-40" : "h-32"}`}>
                  <ToneArt
                    name={page.art}
                    className="h-full transition-transform duration-500 group-hover:scale-[1.03]"
                    sizes="(max-width: 1024px) 100vw, 460px"
                  />
                </div>
              ) : null}

              {/* Tint band. Carries the colour that a text-only tile lacked,
                  and scales with the cell so wide tiles read as heavier. */}
              <div
                className="relative flex items-center gap-4 px-7 pt-7 pb-6"
                style={{ background: style?.tint }}
              >
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-[26px] shadow-sm"
                  aria-hidden="true"
                >
                  {style?.emoji}
                </span>
                <div className="min-w-0">
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                    style={{ color: style?.ink }}
                  >
                    {page.eyebrow}
                  </p>
                  <h2 className="mt-1.5 text-xl font-medium leading-snug text-[#3b322a] sm:text-[1.4rem]">
                    <Link href={`/${page.slug}`} className="after:absolute after:inset-0">
                      {page.h1}
                    </Link>
                  </h2>
                </div>
              </div>

              <div className="flex flex-1 flex-col px-7 pb-7 pt-6">
                <p
                  className={`font-light leading-relaxed text-[#6b5c51] ${
                    wide ? "text-[16px]" : "text-[15px]"
                  }`}
                >
                  {page.tagline}
                </p>

                {/* On a wide tile there is room to name what the page covers,
                    which is the difference between a card and a summary. */}
                {wide ? (
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {page.sections.slice(0, 3).map((section) => (
                      <li
                        key={section.heading}
                        className="rounded-full border border-[#d8cfc1]/80 px-3 py-1 text-[12.5px] font-light text-[#7a6d60]"
                      >
                        {section.heading}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-auto flex items-center justify-between gap-3 pt-6">
                  <span
                    className="text-[13.5px] font-medium"
                    style={{ color: style?.ink }}
                  >
                    Đọc tiếp <span aria-hidden="true">→</span>
                  </span>
                  {appHref ? (
                    // Sits above the card-wide link so it stays clickable.
                    <Link
                      href={appHref}
                      className="relative z-10 rounded-full border border-[#d8cfc1]/80 bg-white/70 px-3.5 py-1.5 text-[12.5px] font-light text-[#6b5c51] transition-colors hover:border-[#c2693f]/40 hover:text-[#a8542f]"
                    >
                      {page.cta.label}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </Reveal>
        );
      })}
    </ul>
  );
}
