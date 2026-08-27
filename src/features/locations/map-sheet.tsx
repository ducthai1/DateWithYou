"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The saved-place list, as a sheet over the map. Mobile only.
 *
 * Why not the existing BottomSheet: that one is modal — it traps focus, dims
 * the page and exists to be dismissed. This one has to be the opposite. The map
 * behind it stays live and tappable (tapping the map is how you add a place),
 * and the sheet never fully goes away; it sits at its lowest stop showing how
 * many places are down there.
 *
 * The old layout stacked map and list vertically, which gave the map 288px at
 * the bottom of a scroll — too small to use and big enough to push everything
 * else down. Overlaying them lets the map have the whole screen while the list
 * stays one thumb-reach away.
 *
 * Three stops rather than a free-floating drag: a discrete set cannot land
 * somewhere useless, and "tap the handle to cycle" works without a gesture at
 * all. Drag is an accelerator, not the only way in.
 *
 * One mount, two layouts. At lg and above this stops being a sheet and becomes
 * a plain block in the desktop two-column grid — done with `lg:!` utilities
 * rather than a JS breakpoint check on purpose. Rendering two copies and hiding
 * one is what put two live maps on this page to begin with, and switching on a
 * media-query hook flashes the wrong layout for a frame because the hook reads
 * false during SSR.
 */

/** Sheet height at each stop, as a fraction of the viewport. */
const STOPS = [0.16, 0.55, 0.92] as const;
type Stop = 0 | 1 | 2;

export function MapSheet({
  count,
  children,
  className,
}: {
  /** How many places are in the list, shown while collapsed. */
  count: number;
  children: React.ReactNode;
  className?: string;
}) {
  const [stop, setStop] = useState<Stop>(1);
  const [dragOffset, setDragOffset] = useState(0);
  const startY = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const cycle = useCallback(() => {
    setStop((s) => (((s + 1) % STOPS.length) as Stop));
  }, []);

  // Collapsing should not leave the list scrolled halfway down — the top of the
  // list is what the collapsed strip is a handle for.
  useEffect(() => {
    if (stop === 0) scrollRef.current?.scrollTo({ top: 0 });
  }, [stop]);

  const onPointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (startY.current == null) return;
    setDragOffset(e.clientY - startY.current);
  };

  const onPointerUp = () => {
    if (startY.current == null) return;
    const moved = dragOffset;
    startY.current = null;
    setDragOffset(0);
    // A short movement is a tap, and a tap cycles. Anything longer picks the
    // next stop in the direction of travel — dragging down should never expand.
    if (Math.abs(moved) < 12) {
      cycle();
      return;
    }
    setStop((s) => {
      const next = moved > 0 ? s - 1 : s + 1;
      return Math.min(STOPS.length - 1, Math.max(0, next)) as Stop;
    });
  };

  const heightVh = STOPS[stop] * 100;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-3xl border-t border-border bg-card shadow-[0_-8px_30px_rgba(0,0,0,0.18)]",
        // Desktop: not a sheet at all. `!` beats the inline height below.
        "lg:!static lg:!h-auto lg:!transform-none lg:!transition-none lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none lg:!pb-0",
        className,
      )}
      style={{
        height: `${heightVh}dvh`,
        // Follow the finger while dragging, then let the height transition take
        // over. Transitioning during a drag makes it feel laggy.
        transform: dragOffset ? `translateY(${Math.max(0, dragOffset)}px)` : undefined,
        transition: dragOffset ? "none" : "height 260ms cubic-bezier(0.16,1,0.3,1), transform 260ms cubic-bezier(0.16,1,0.3,1)",
        // Clear the bottom navigation bar.
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* Handle. It is a real button so it works without a pointer gesture and
          announces what it does; the drag handlers ride on top of it. */}
      <button
        type="button"
        onClick={(e) => {
          // The pointer handlers already cycled on tap; don't do it twice.
          if (e.detail !== 0) return;
          cycle();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label={
          stop === 0 ? "Mở danh sách địa điểm" : stop === 2 ? "Thu nhỏ danh sách" : "Mở rộng danh sách"
        }
        className="flex w-full shrink-0 touch-none flex-col items-center gap-1.5 px-4 pt-2.5 pb-2 lg:hidden"
      >
        <span className="h-1 w-10 rounded-full bg-muted-foreground/35" />
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
          <ChevronUp
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              stop === 2 && "rotate-180",
            )}
          />
          {count > 0 ? `${count} địa điểm` : "Chưa có địa điểm"}
        </span>
      </button>

      <div
        ref={scrollRef}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4",
          "lg:overflow-visible lg:px-0 lg:pb-0",
          // Collapsed, the content is a hint of what is below rather than
          // something to scroll — letting it scroll at 16dvh just traps a
          // finger meant for the map.
          // Only while it is a sheet — on desktop the list is the column.
          stop === 0 && "pointer-events-none overflow-hidden opacity-60 lg:pointer-events-auto lg:overflow-visible lg:opacity-100",
        )}
      >
        {children}
      </div>
    </div>
  );
}
