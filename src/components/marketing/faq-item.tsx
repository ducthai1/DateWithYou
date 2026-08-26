"use client";

import { useRef } from "react";

/**
 * One FAQ row that opens and closes with motion.
 *
 * Still a real <details>/<summary>: keyboard behaviour, screen-reader semantics
 * and — the reason it matters here — the answer text staying in the DOM while
 * collapsed all come free, and the same answers are mirrored into the FAQPage
 * structured data.
 *
 * CSS OWNS THE MOTION. Both paths in globals.css are transitions, and that is
 * the whole design. An earlier version animated the height from JavaScript:
 * measure the target, cancel on re-click, reverse by hand. Every fix for fast
 * clicking uncovered another interleaving — measuring after a cancel read a
 * stale value, a finished animation's cleanup cancelled its successor, a close
 * starting from zero animated nothing and then snapped. A CSS transition cannot
 * have those bugs, because the browser reverses it from wherever it currently
 * is; there is nothing to measure and nothing to cancel.
 *
 * What is left for JavaScript is only WHEN the content is mounted:
 *   - Chrome/Edge 129+ have ::details-content, so even that is unnecessary and
 *     the click is left completely alone.
 *   - Elsewhere, `open` mounts the content and a class drives the transition;
 *     `open` is cleared again once the collapse has finished.
 */

/** Feature-detected lazily, then cached — this must match the @supports test. */
function supportsNativeDisclosure() {
  return (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("interpolate-size", "allow-keywords") &&
    CSS.supports("selector(::details-content)")
  );
}

export function FaqItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const nativeRef = useRef<boolean | null>(null);

  function toggle(event: React.MouseEvent) {
    if (nativeRef.current === null) nativeRef.current = supportsNativeDisclosure();
    // Native path: don't touch the event, CSS does everything.
    if (nativeRef.current) return;

    const details = detailsRef.current;
    const grid = gridRef.current;
    if (!details || !grid) return;

    event.preventDefault();

    if (details.dataset.open === "true") {
      // Collapse. `open` stays set for now so the content is still mounted for
      // the browser to animate away; unmountAfterCollapse clears it.
      details.dataset.open = "false";
      unmountAfterCollapse(details, grid);
      return;
    }

    details.open = true;
    /*
     * Force the collapsed value to be computed before flipping the class.
     * Without this the element mounts and changes to 1fr within one style
     * resolution, so the browser has no start value to transition from and it
     * appears instantly. A synchronous reflow rather than requestAnimationFrame
     * on purpose: a deferred callback can land after the user has already
     * clicked again, which is exactly the ordering hazard this file exists to
     * stop having.
     */
    void grid.offsetHeight;
    details.dataset.open = "true";
  }

  /**
   * Clear `open` once the collapse has actually finished.
   *
   * Deliberately driven by the element's running animations rather than a
   * transitionend listener. After a burst of clicks the last one often sets
   * data-open="false" while the row is ALREADY at 0fr — nothing changes, so no
   * transition starts, so transitionend never fires and `open` stayed set
   * forever: the row read as collapsed but still reserved its full height.
   * Asking what is actually animating covers both cases.
   */
  function unmountAfterCollapse(details: HTMLDetailsElement, grid: HTMLElement) {
    const anims =
      typeof grid.getAnimations === "function" ? grid.getAnimations() : [];

    if (anims.length === 0) {
      // Nothing to wait for — it was already collapsed, or transitions are off.
      details.open = false;
      return;
    }

    Promise.all(
      // A reversal cancels these, which rejects; that is a normal outcome here.
      anims.map((a) => a.finished.catch(() => undefined)),
    ).then(() => {
      // Re-opened in the meantime? Then this collapse was superseded.
      if (details.dataset.open !== "true") details.open = false;
    });
  }

  return (
    <details ref={detailsRef} data-open="false" className="faq-row group py-5">
      <summary
        onClick={toggle}
        className="focus-visible:ring-ring/50 flex cursor-pointer list-none items-center justify-between gap-6 rounded-lg text-left text-[17px] font-medium text-[#3b322a] outline-none marker:content-none focus-visible:ring-2"
      >
        <h3 className="text-[17px] font-medium">{question}</h3>
        {/* Rotates off `open` on the native path and off `data-open` on the
            scripted one, so the sign always tracks what the panel is doing. */}
        <span
          aria-hidden="true"
          className="shrink-0 text-xl leading-none text-[#a8542f] transition-transform duration-[460ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-open:rotate-45 group-data-[open=true]:rotate-45"
        >
          +
        </span>
      </summary>
      <div ref={gridRef} className="faq-grid">
        <div>
          <p className="mt-4 pr-10 text-[15px] font-light leading-relaxed text-[#6b5c51]">
            {answer}
          </p>
        </div>
      </div>
    </details>
  );
}
