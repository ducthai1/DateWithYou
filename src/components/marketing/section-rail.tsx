"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * Right-hand section rail plus a back-to-top button.
 *
 * One component rather than two because both need the same thing — to know
 * where the reader currently is — and running a single IntersectionObserver for
 * both is cheaper than two scroll listeners.
 *
 * The rail is a nav landmark with real links, so it works before hydration and
 * for keyboard and screen-reader users; the observer only decides which one is
 * marked current. Labels are revealed on hover/focus so the resting state is a
 * quiet column of ticks rather than a wall of text over the content.
 */
const SECTIONS = [
  { id: "gioi-thieu", label: "Giới thiệu" },
  { id: "tinh-nang", label: "Tính năng" },
  { id: "bat-dau", label: "Bắt đầu" },
  { id: "hoi-dap", label: "Hỏi đáp" },
  { id: "dang-ky", label: "Đăng ký" },
] as const;

export function SectionRail() {
  const [active, setActive] = useState<string | null>(null);
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    const targets = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    );

    /*
     * A band across the middle of the viewport decides what counts as "current".
     * Picking whatever is merely on screen makes the marker flicker between two
     * sections while a long one scrolls past; a mid-viewport band gives one
     * answer at a time.
     */
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    targets.forEach((el) => io.observe(el));

    /*
     * "Have we left the hero yet" used to be a scroll listener that ran a React
     * setState on every single scroll event. Even bailing out on an unchanged
     * value, that is work on the scroll path — the one place where work is most
     * expensive. A second observer on the hero answers the same question by
     * firing twice in the page's whole lifetime instead of hundreds of times.
     */
    const hero = document.querySelector(".landing-root > :first-child");
    const heroIo = new IntersectionObserver(
      ([entry]) => setPastHero(!entry.isIntersecting),
      { rootMargin: "-40% 0px 0px 0px", threshold: 0 },
    );
    if (hero) heroIo.observe(hero);

    return () => {
      io.disconnect();
      heroIo.disconnect();
    };
  }, []);

  return (
    <>
      {/* Rail — pointer-capable widths only. At phone width there is no room
          beside the content, and a floating column would cover it. */}
      <nav
        aria-label="Mục trên trang"
        className={`fixed top-1/2 right-5 z-40 hidden -translate-y-1/2 flex-col gap-1 transition-opacity duration-500 lg:flex ${
          pastHero ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {SECTIONS.map((s) => {
          const isActive = active === s.id;
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              aria-current={isActive ? "true" : undefined}
              className="group/rail flex items-center justify-end gap-2.5 py-1.5 outline-none"
            >
              <span
                className={`origin-right text-[12px] whitespace-nowrap transition-all duration-300 ${
                  isActive
                    ? "text-[#a8542f] opacity-100"
                    : "text-[#8a7d70] opacity-0 group-hover/rail:opacity-100 group-focus-visible/rail:opacity-100"
                }`}
              >
                {s.label}
              </span>
              {/* The tick itself: grows and takes the accent when current. */}
              <span
                aria-hidden="true"
                className={`h-[2px] rounded-full transition-all duration-300 ${
                  isActive
                    ? "w-7 bg-[#a8542f]"
                    : "w-3.5 bg-[#c9bfb2] group-hover/rail:w-5 group-hover/rail:bg-[#a8542f]"
                }`}
              />
            </a>
          );
        })}
      </nav>

      {/* Back to top — this one stays on phones, where the page is longest in
          proportion to the screen and scrolling back by hand is worst. */}
      <a
        href="#top"
        aria-label="Về đầu trang"
        /*
          No backdrop-blur here. It is a position: fixed element, so a
          backdrop-filter makes the compositor re-sample and re-blur what is
          behind it on every scrolled frame — a well-known cause of exactly the
          mid-swipe stutter this is meant to help with. An opaque background
          costs nothing and looks the same over this page.

          `transition-all` is also gone: it animates every property that ever
          changes, including the transform used on hover, which is not what the
          show/hide is about.
        */
        className={`focus-visible:ring-ring/50 fixed right-4 bottom-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-[#d8cfc1] bg-[#faf7f2] text-[#6b5c51] shadow-[0_6px_20px_rgba(59,50,42,0.12)] outline-none transition-[opacity,transform,color] duration-500 hover:-translate-y-0.5 hover:text-[#a8542f] focus-visible:ring-2 active:scale-95 lg:right-6 lg:bottom-7 ${
          pastHero
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <ArrowUp className="h-[18px] w-[18px]" />
      </a>
    </>
  );
}
