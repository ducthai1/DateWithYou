"use client";

import Image from "next/image";
import Link from "next/link";
import { useTone } from "@/components/theme/tone-provider";
import { logoSrc } from "@/lib/tone";
import { ToneArt } from "@/components/theme/tone-art";

/*
 * The landing hero.
 *
 * Used to be a dark teal band built around one wide artwork with the wordmark
 * baked into its pixels. That artwork is retired — it read as a different,
 * moodier product than the warm parchment (#fdfaf6) the rest of the page
 * opens into right below it, which is exactly the seam a hero should not
 * have. The ground here now matches that parchment so the page reads as one
 * place from the first pixel.
 *
 * Two columns above lg: wordmark, tagline, CTAs and scroll cue on one side,
 * the `heroDesk` artwork on the other. Below lg there is no width to split, so
 * it stacks — wordmark and copy first, artwork after, in plain source order
 * (no `order-*` needed).
 *
 * The wordmark is rendered directly through `logoSrc` + next/image rather than
 * <BrandMark>: that component hard-codes `sizes="176px"`, tuned for the header
 * lockup, and stretching it here would ship a header-sized file scaled up in
 * CSS instead of a properly sized one.
 *
 * A Client Component now, where the old dark hero was a Server Component — the
 * wordmark's file depends on the reader's tone (`useTone`), which is a React
 * context read, not a library. What actually cost LCP before was
 * framer-motion holding the image at opacity 0 until hydration ran (measured:
 * 4.7s of render delay, 91% of a 5.1s LCP, while the file itself downloaded in
 * 0ms) — a client component that paints its <img> straight into the
 * server-rendered HTML, as this one does, never hides it like that. The
 * entrance motion below is still plain CSS (`vivu-rise`), not JS re-added.
 */

/** Matches the parchment the rest of the page opens into. */
const GROUND = "#fdfaf6";

export function LandingHero() {
  const { tone } = useTone();

  return (
    <div
      className="hero-band relative flex min-h-dvh flex-col items-center justify-center px-5 py-16 lg:px-10 xl:px-14 short:py-8"
      style={{ backgroundColor: GROUND }}
    >
      <div className="mx-auto grid w-full max-w-[1400px] items-center gap-10 lg:grid-cols-[24rem_minmax(0,1fr)] lg:gap-12 xl:max-w-[1600px] xl:grid-cols-[26rem_minmax(0,1fr)] xl:gap-14 2xl:max-w-[1800px] 2xl:grid-cols-[28rem_minmax(0,1fr)]">
        {/* Copy column. */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          {/*
            Decorative, same reasoning as the old baked-in artwork: the name is
            already in the sr-only <h1> below, so a screen reader would
            announce it twice if this carried alt text too.

            Sized off width with an aspect-ratio box matching the file's own
            1672x941 canvas, rather than `fill` inside a height-only box — the
            file has generous letterboxing built in, so driving the box from
            width and letting height follow keeps that letterboxing intact
            instead of cropping into it.
          */}
          <div className="relative aspect-[1672/941] w-[240px] sm:w-[300px] lg:w-full short:w-[210px]">
            <Image
              src={logoSrc("wordmark", tone)}
              alt=""
              aria-hidden="true"
              fill
              sizes="(min-width: 1536px) 448px, (min-width: 1280px) 416px, (min-width: 1024px) 384px, (min-width: 640px) 300px, 240px"
              className="object-contain"
            />
          </div>

          <h1 className="sr-only">Vivu No Plan</h1>

          <p
            className="vivu-rise mt-7 max-w-sm text-[15px] font-light leading-relaxed text-[#6b5c51] sm:text-base lg:max-w-none"
            style={{ animationDelay: "320ms" }}
          >
            Nơi giữ lại những chỗ đã đi, món đã ăn và những hôm đáng nhớ — đi một
            mình cũng được, có người đi cùng càng vui.
          </p>

          <div
            className="vivu-rise mt-9 flex w-full max-w-sm flex-col gap-3.5 lg:max-w-none"
            style={{ animationDelay: "560ms" }}
          >
            <Link
              href="/map"
              className="group relative flex h-14 w-full items-center justify-center overflow-hidden rounded-full bg-[#c2693f] text-white shadow-[0_10px_28px_rgba(194,105,63,0.28)] transition-all hover:-translate-y-0.5 hover:bg-[#a8542f] active:translate-y-0 active:scale-[0.98]"
            >
              <span className="relative z-10 text-[17px] font-medium tracking-wide">
                Vào không gian
              </span>
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 ease-in-out group-hover:translate-x-full" />
            </Link>

            <Link
              href="/sign-up"
              className="flex h-14 w-full items-center justify-center rounded-full border border-[#d8cfc1]/80 bg-white/40 text-[#6f675d] backdrop-blur-md transition-all hover:border-[#d8cfc1] hover:bg-white/70 active:scale-[0.98]"
            >
              <span className="text-[17px] font-medium tracking-wide">
                Tạo tài khoản
              </span>
            </Link>
          </div>

        </div>

        {/*
          Artwork column, capped on short viewports the same way the old
          picture was: `short:` plus `w-auto`, letting the intrinsic aspect
          ratio drive the shrink instead of a fixed height that would crop it.
          This lives inside a grid row, so an oversized image here would drag
          the copy column's vertical centring down with it rather than just
          growing past the fold on its own.
        */}
        <div className="mx-auto w-full max-w-[560px] lg:mx-0 lg:max-w-none">
          <ToneArt
            name="heroDesk"
            priority
            sizes="(min-width: 1536px) 1400px, (min-width: 1024px) 68vw, (min-width: 640px) 560px, 92vw"
            className="overflow-hidden rounded-[28px] border border-[#d8cfc1]/70 shadow-[0_20px_50px_rgba(59,50,42,0.12)] short:mx-auto short:max-h-[30vh] short:w-auto"
          />
        </div>
      </div>

      {/* Scroll affordance — the hero is min-h-dvh, so without it everything
          below sits past the fold with nothing hinting it exists.

          It sits outside the two-column grid on purpose. Inside the copy
          column it centred against the text, which on a wide screen put it
          well left of the middle of the window — and this link belongs to the
          whole hero, not to one half of it. */}
      <a
        href="#gioi-thieu"
        className="vivu-rise mt-12 flex flex-col items-center gap-1.5 rounded-full px-4 py-2 text-[#8a7c6f] transition-colors hover:text-[#a8542f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a8542f] short:mt-6"
        style={{ animationDelay: "1400ms" }}
      >
        <span className="text-xs font-light tracking-wide">Tìm hiểu thêm</span>
        <span aria-hidden="true" className="vivu-nudge text-lg leading-none">
          ↓
        </span>
      </a>
    </div>
  );
}
