"use client";

import { useRef } from "react";

/**
 * One FAQ row that opens and closes with motion.
 *
 * Still a real <details>/<summary>: keyboard behaviour, screen-reader
 * semantics and — the reason it matters here — the answer text staying in the
 * DOM while collapsed all come free, and the same answers are mirrored into the
 * FAQPage structured data. A hand-rolled div-and-state accordion would have to
 * re-earn all of that.
 *
 * <details> gives no transition of its own: the browser flips between rendered
 * and not rendered, which is the "giật cái đùng" this replaces. So the toggle is
 * intercepted and the body's height is animated with the Web Animations API —
 * opening sets `open` first and grows from 0, closing shrinks to 0 and only then
 * clears `open`, so the content is never unmounted mid-animation.
 */
export function FaqItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);
  /*
   * `details.open` alone cannot tell us the user's intent while a collapse is
   * still running: we only clear `open` when that animation finishes, so a click
   * mid-collapse would read as "close it again". This tracks that window.
   */
  const closingRef = useRef(false);

  function toggle(event: React.MouseEvent) {
    const details = detailsRef.current;
    const body = bodyRef.current;
    if (!details || !body) return;

    // Take over from the native toggle so we control when `open` flips.
    event.preventDefault();

    // Reversing mid-flight must not stack animations on top of each other.
    animRef.current?.cancel();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      details.open = !details.open;
      closingRef.current = false;
      return;
    }

    const shouldOpen = !details.open || closingRef.current;

    /*
     * A closed <details> hides its content with content-visibility: hidden,
     * and that keeps the element's LAST rendered size cached — so
     * getBoundingClientRect() reports the full height even while collapsed.
     * Measuring it as the animation's start value produced a run from 89px to
     * 89px: an animation that played correctly and changed nothing. Opening
     * therefore starts from 0 unless we are reversing a collapse that is still
     * in flight, where the live height is the honest starting point.
     */
    const live = body.getBoundingClientRect().height;
    const target = body.scrollHeight;

    if (shouldOpen) {
      closingRef.current = false;
      details.open = true;
      const from = live > 0 && live < target ? live : 0;
      animRef.current = body.animate(
        { height: [`${from}px`, `${target}px`], opacity: [from === 0 ? 0 : 1, 1] },
        { duration: 460, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      );
      animRef.current.onfinish = () => {
        body.style.height = "";
      };
    } else {
      closingRef.current = true;
      animRef.current = body.animate(
        { height: [`${live}px`, "0px"], opacity: [1, 0] },
        { duration: 340, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
      );
      animRef.current.onfinish = () => {
        // Only now is it safe to unmount the content.
        details.open = false;
        closingRef.current = false;
        body.style.height = "";
      };
    }
  }

  return (
    <details ref={detailsRef} className="group py-5">
      <summary
        onClick={toggle}
        className="focus-visible:ring-ring/50 flex cursor-pointer list-none items-center justify-between gap-6 rounded-lg text-left text-[17px] font-medium text-[#3b322a] outline-none marker:content-none focus-visible:ring-2"
      >
        <h3 className="text-[17px] font-medium">{question}</h3>
        <span
          aria-hidden="true"
          className="shrink-0 text-xl leading-none text-[#a8542f] transition-transform duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-open:rotate-45"
        >
          +
        </span>
      </summary>
      {/* overflow-hidden is what makes the height animation read as a reveal
          rather than the text sliding out of its own box. */}
      <div ref={bodyRef} className="overflow-hidden">
        <p className="mt-4 pr-10 text-[15px] font-light leading-relaxed text-[#6b5c51]">
          {answer}
        </p>
      </div>
    </details>
  );
}
