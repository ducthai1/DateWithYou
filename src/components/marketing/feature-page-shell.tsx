import Link from "next/link";
import { Reveal } from "./reveal";
import { FaqItem } from "./faq-item";
import type { FeaturePage } from "./feature-pages";
import { FEATURE_PAGE_APP_HREF } from "./feature-pages";
import { SITE_NAME } from "@/lib/site";

/*
 * Renders one feature page. Plain Server Components, no JavaScript attached to
 * the prose: these pages exist to be read by a crawler and by someone who
 * arrived from a search result, so the text ships in the initial HTML.
 *
 * The layout is shared but the content is not, and that distinction is the
 * whole safety margin here. Four pages sharing a skeleton is normal; four pages
 * sharing their argument with keywords swapped is a doorway-page pattern that
 * Google penalises across the whole site. Each content file makes its own case
 * in its own order — see the comments in feature-pages/*.ts.
 *
 * Palette matches the landing page's warm parchment set rather than the app's
 * theme tokens: nobody reading this is inside a space yet, so the per-space
 * accent does not apply and the page must look the same to every visitor.
 */

function Prose({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="mt-6 space-y-5">
      {paragraphs.map((text) => (
        <p
          key={text.slice(0, 40)}
          className="text-[17px] font-light leading-[1.75] text-[#6b5c51]"
        >
          {text}
        </p>
      ))}
    </div>
  );
}

export function FeaturePageShell({ page }: { page: FeaturePage }) {
  const appHref = FEATURE_PAGE_APP_HREF[page.slug];

  return (
    <div className="relative bg-[#fdfaf6] text-[#3b322a]">
      <article className="mx-auto max-w-3xl px-6 pt-14 pb-20 sm:pt-20 sm:pb-28">
        {/* Link back to the hub. Also the visible counterpart of the
            BreadcrumbList in the structured data. */}
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
            {page.eyebrow}
          </p>
          <h1 className="mt-4 text-[2rem] font-medium leading-[1.15] tracking-tight text-[#3b322a] sm:text-[2.75rem]">
            {page.h1}
          </h1>
          <p className="mt-6 text-lg font-light leading-relaxed text-[#6b5c51]">
            {page.tagline}
          </p>
        </Reveal>

        {page.sections.map((section, i) => (
          <Reveal as="section" key={section.heading} delay={Math.min(i, 4) * 110}>
            <div className="mt-16 border-t border-[#d8cfc1]/60 pt-12">
              <h2 className="text-2xl font-medium tracking-tight text-[#3b322a] sm:text-[1.75rem]">
                {section.heading}
              </h2>
              {section.paragraphs ? <Prose paragraphs={section.paragraphs} /> : null}
              {section.items ? (
                <ul className="mt-8 space-y-6">
                  {section.items.map((item) => (
                    <li
                      key={item.label}
                      className="rounded-2xl border border-[#d8cfc1]/70 bg-white/50 p-6"
                    >
                      <h3 className="text-base font-medium text-[#3b322a]">
                        {item.label}
                      </h3>
                      <p className="mt-2.5 text-[15px] font-light leading-relaxed text-[#6b5c51]">
                        {item.body}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Reveal>
        ))}

        {/* FAQ — mirrored verbatim into this page's FAQPage JSON-LD. Native
            <details> so the answers are in the HTML even while collapsed. */}
        <Reveal as="section">
          <div className="mt-16 border-t border-[#d8cfc1]/60 pt-12">
            <h2 className="text-2xl font-medium tracking-tight text-[#3b322a] sm:text-[1.75rem]">
              Hỏi đáp
            </h2>
            <div className="mt-8 divide-y divide-[#d8cfc1]/60 border-y border-[#d8cfc1]/60">
              {page.faq.map((item) => (
                <FaqItem key={item.question} question={item.question} answer={item.answer} />
              ))}
            </div>
          </div>
        </Reveal>

        {/* Call to action. Sign-up is primary because the app route below is
            auth-gated — sending a visitor straight there lands them on a
            sign-in wall with no explanation. */}
        <Reveal as="section">
          <div className="mt-16 border-t border-[#d8cfc1]/60 pt-12 text-center">
            <h2 className="text-2xl font-medium tracking-tight text-[#3b322a] sm:text-[1.75rem]">
              {page.cta.heading}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] font-light leading-relaxed text-[#6b5c51]">
              {page.cta.body}
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
              <Link
                href="/sign-up"
                className="flex h-14 w-full max-w-xs items-center justify-center rounded-full bg-[#c2693f] text-[17px] font-medium tracking-wide text-white shadow-[0_8px_20px_rgba(194,105,63,0.25)] transition-all hover:-translate-y-0.5 hover:bg-[#a8542f] active:translate-y-0 active:scale-[0.98]"
              >
                Tạo tài khoản
              </Link>
              {appHref ? (
                <Link
                  href={appHref}
                  className="flex h-14 w-full max-w-xs items-center justify-center rounded-full border border-[#d8cfc1]/80 bg-white/40 text-[17px] font-medium tracking-wide text-[#6f675d] transition-all hover:border-[#d8cfc1] hover:bg-white/70 active:scale-[0.98]"
                >
                  {page.cta.label}
                </Link>
              ) : null}
            </div>
          </div>
        </Reveal>

        {/* Sibling links. Without these each page is an orphan that nothing
            points at, which makes it harder for a crawler to justify visiting. */}
        <Reveal as="nav">
          <div className="mt-16 border-t border-[#d8cfc1]/60 pt-12">
            <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-[#a8542f]">
              Xem thêm
            </h2>
            <ul className="mt-7 grid gap-4 sm:grid-cols-3">
              {page.related.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="group block h-full rounded-2xl border border-[#d8cfc1]/70 bg-white/50 p-5 transition-colors hover:border-[#c2693f]/40 hover:bg-white/80"
                  >
                    <span className="block text-[15px] font-medium text-[#3b322a] group-hover:text-[#a8542f]">
                      {link.label}
                    </span>
                    <span className="mt-2 block text-[13px] font-light leading-relaxed text-[#6b5c51]">
                      {link.blurb}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </article>

      <footer className="border-t border-[#d8cfc1]/60 px-6 py-10 text-center text-sm font-light text-[#7a6d60]">
        <p>
          <Link href="/" className="transition-colors hover:text-[#a8542f]">
            {SITE_NAME}
          </Link>{" "}
          — giữ lại những chuyến đi của bạn. Làm tại Việt Nam.
        </p>
      </footer>
    </div>
  );
}
