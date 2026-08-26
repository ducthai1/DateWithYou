import Link from "next/link";

/*
 * The landing hero.
 *
 * The brand artwork is a dark, atmospheric piece with its glow and mist baked
 * in, so it cannot be cut out and dropped onto the cream page — the hero band
 * goes dark around it instead and the page opens back into cream below. The
 * ground colour is sampled from the artwork's own corners (#021617), and the
 * images ship with their edges already feathered to that exact value — baked
 * into the pixels rather than layered on in CSS, so a narrow phone viewport
 * cannot make the fade too short to hide the boundary.
 *
 * The artwork carries the wordmark, so the <h1> is present for crawlers and
 * screen readers but visually hidden — showing both would print the brand name
 * twice.
 *
 * A Server Component: the entrance animations are CSS, so nothing here needs to
 * ship to the browser. It used framer-motion, which made it client-side and put
 * ~45kB of JavaScript in front of the largest paint on the one page search
 * engines actually read.
 */

/** Sampled from the artwork's corners so `object-contain` bars are invisible. */
const GROUND = "#021617";

export function LandingHero() {
  return (
    <div
      className="hero-band relative flex min-h-dvh flex-col items-center justify-center px-5 py-16"
      style={{ backgroundColor: GROUND }}
    >
      {/* Stacked, not layered. An earlier pass floated the copy over the
          artwork and the tagline landed on top of the "NO PLAN" plaque; laying
          them out in flow makes that collision impossible at any viewport. */}
      {/*
        Deliberately NOT animated in from opacity 0. This is the LCP element,
        and framer-motion holds an element invisible until hydration runs — so
        fading it in parked the largest paint behind the entire client runtime.
        Measured: 4.7s of render delay, 91% of a 5.1s LCP, while the image
        itself downloaded in 0ms. It paints with the HTML now; the copy below
        still animates, which reads as the page settling rather than a delay.
      */}
      <div className="relative w-full max-w-[560px] md:max-w-[900px]">
        {/*
          Two crops of the same artwork: the wide one keeps the filigree that
          sweeps out either side, which on a phone would shrink the lettering to
          nothing, so a tighter crop takes over below md.

          Deliberately a <picture> with plain <img> rather than next/image. Art
          direction needs exactly ONE of the two files to download, and the
          browser's preload scanner has to find it in the raw HTML — this is the
          LCP element. Rendering both through next/image and hiding one with CSS
          fetched both and left the scanner preloading the wrong one, which cost
          seconds of LCP. The files are already sized and compressed for their
          breakpoints, so the optimiser has nothing left to add.
        */}
        <picture>
          <source
            media="(min-width: 768px)"
            type="image/webp"
            srcSet="/hero-logo.webp"
            width={1800}
            height={840}
          />
          <source type="image/webp" srcSet="/hero-logo-tight.webp" width={1200} height={749} />
          {/* JPEG stays as the last-resort source for anything without WebP.
              eslint-disable-next-line @next/next/no-img-element */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero-logo-tight.jpg"
            alt=""
            aria-hidden="true"
            width={1200}
            height={749}
            fetchPriority="high"
            // No decoding="async" here: this is the LCP element, and async
            // explicitly permits the browser to defer the decode — exactly the
            // paint we are waiting on.
            decoding="sync"
            className="h-auto w-full"
          />
        </picture>
      </div>

      {/* The artwork already sets the name; this keeps it in the document for
          search engines and screen readers without printing it twice. */}
      <h1 className="sr-only">Vivu No Plan</h1>

      <p
        className="vivu-rise mt-7 max-w-sm text-center text-[15px] font-light leading-relaxed text-[#BFD9DE] sm:text-base"
        style={{ animationDelay: "320ms" }}
      >
        Nơi lưu kỷ niệm, lên kế hoạch hẹn hò và giữ những điều bí mật ngọt ngào
        của tụi mình.
      </p>

      <div
        className="vivu-rise mt-9 flex w-full max-w-sm flex-col gap-3.5"
        style={{ animationDelay: "560ms" }}
      >
        <Link
          href="/map"
          className="group relative flex h-14 w-full items-center justify-center overflow-hidden rounded-full bg-[#c2693f] text-white shadow-[0_10px_28px_rgba(0,0,0,0.45)] transition-all hover:-translate-y-0.5 hover:bg-[#a8542f] active:translate-y-0 active:scale-[0.98]"
        >
          <span className="relative z-10 text-[17px] font-medium tracking-wide">
            Vào không gian
          </span>
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 ease-in-out group-hover:translate-x-full" />
        </Link>

        <Link
          href="/sign-up"
          className="flex h-14 w-full items-center justify-center rounded-full border border-white/25 bg-white/5 text-[#E4F2F5] backdrop-blur-md transition-all hover:border-white/45 hover:bg-white/10 active:scale-[0.98]"
        >
          <span className="text-[17px] font-medium tracking-wide">
            Tạo tài khoản
          </span>
        </Link>
      </div>

      {/* Scroll affordance — the hero is min-h-dvh, so without it everything
          below sits past the fold with nothing hinting it exists. */}
      {/* In flow, not absolutely positioned: pinned to the bottom it landed on
          top of the second button on shorter viewports. */}
      <a
        href="#gioi-thieu"
        className="vivu-rise mt-10 flex w-fit flex-col items-center gap-1.5 rounded-full px-4 py-2 text-[#8FB3BB] transition-colors hover:text-[#DCEFF2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5FAAC3]"
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
