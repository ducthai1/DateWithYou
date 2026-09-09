"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A scroll box with a fade at whichever edge still has content behind it.
 *
 * A box capped in height silently cuts its content off: the last row sat
 * below the fold with a flat edge under it, which reads as the end of the
 * list rather than as more to come. The fades only appear when there is
 * actually something past the edge, so a short list shows none.
 *
 * `className` styles the scrolling box itself (padding, gap); `fadeClassName`
 * sets the colour the fade dissolves from — the surface behind the content.
 */
export function FadeScroll({
  children,
  className,
  fadeClassName = "from-card",
  hideScrollbar = false,
}: {
  children: React.ReactNode;
  className?: string;
  fadeClassName?: string;
  /**
   * Drop the scrollbar and let the fades do the telling.
   *
   * For a column of links beside an article, a bar is noise — it reads as a
   * second page inside the page. Not for a form in a dialog, where people
   * reach for the bar to see how much is left, which is why this is a choice
   * and not the default.
   */
  hideScrollbar?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const more = el.scrollHeight - el.clientHeight;
      setEdges({
        top: el.scrollTop > 4,
        bottom: more > 4 && el.scrollTop < more - 4,
      });
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b to-transparent transition-opacity duration-200",
          fadeClassName,
          edges.top ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        ref={ref}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          hideScrollbar &&
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className,
        )}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        data-fade-bottom={edges.bottom ? "on" : "off"}
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t to-transparent transition-opacity duration-200",
          fadeClassName,
          edges.bottom ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
