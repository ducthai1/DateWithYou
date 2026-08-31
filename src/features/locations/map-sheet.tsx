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
 * `raiseTo` is a one-shot nudge, not a clamp. The add/edit form renders
 * inside this sheet's scrollable body, so opening it while the sheet sits at
 * its collapsed stop (pointer-events-none, opacity-60) put the form in the
 * DOM with nothing visible to the person who just tapped "+ Thêm". The parent
 * flips `raiseTo` on the closed→open transition of the form; this only ever
 * raises `stop`, never lowers it, and closing the form does not move the
 * sheet — a manual drag back down while the form stays open (to tap the map
 * and correct a pin) must keep working.
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

/**
 * Vertical gap kept between the sheet's bottom edge and the true bottom of
 * the screen — the bottom nav's own footprint (see its z-index comment
 * below for why the sheet must stop short of it). Shared by the `bottom`
 * offset and the height cap a few lines down so the two cannot drift apart:
 * a stop's height is a fraction of the *whole* viewport, but the space
 * actually free for the sheet is one nav-height less than that, and the cap
 * has to subtract the same amount the offset adds.
 */
const NAV_CLEARANCE = "calc(4.75rem + env(safe-area-inset-bottom, 0px))";

export function MapSheet({
  count,
  children,
  className,
  raiseTo,
  collapseSignal,
}: {
  /** How many places are in the list, shown while collapsed. */
  count: number;
  children: React.ReactNode;
  className?: string;
  /**
   * Bump the sheet up to at least this stop. Read once per change, not held
   * as a floor: pass a new value (e.g. from `formOpen`) to raise the sheet,
   * and leave it `undefined`/unchanged the rest of the time so a manual drag
   * afterwards is not fought on every render.
   */
  raiseTo?: 1 | 2;
  /**
   * Bump this number to drop the sheet back to its lowest stop.
   *
   * A counter rather than a boolean because the parent needs to ask twice in a
   * row for the same thing — pressing "Chỉ đường" on a second place has to
   * lower the sheet again even though it asked last time too.
   */
  collapseSignal?: number;
}) {
  /*
   * Opens at the lowest stop. Half height on arrival meant the map — the whole
   * reason for this layout — was a sliver behind the sheet, which is the same
   * mistake as the 288px strip this replaced, just from the other direction.
   * The handle says how many places are down there, so the list is one tap
   * away rather than hidden.
   */
  const [stop, setStop] = useState<Stop>(0);
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

  // Raise-on-open for the form (see the `raiseTo` doc above). Fires on every
  // change of `raiseTo`, not on every render — the parent only changes it on
  // the false→true transition of `formOpen`, so this does not re-fight a
  // manual drag taken after the form was already open and raised once.
  useEffect(() => {
    if (raiseTo == null) return;
    setStop((s) => (s < raiseTo ? raiseTo : s));
  }, [raiseTo]);

  // Lower-on-signal. Skips the first run so a mounted sheet is not yanked down
  // before the reader has done anything. Goes through the same height
  // transition as every other stop change, so it glides rather than snapping.
  const collapseSeen = useRef<number | undefined>(collapseSignal);
  useEffect(() => {
    if (collapseSignal === undefined) return;
    if (collapseSeen.current === collapseSignal) return;
    collapseSeen.current = collapseSignal;
    setStop(0);
  }, [collapseSignal]);

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
        // Positioned ABOVE the bottom nav, not behind it. Anchored at bottom-0 the
        // last rows of the list were permanently under the nav — scrolling the
        // sheet to its end still left them covered. Reserving the space inside the
        // sheet instead only shrank the collapsed state to a useless sliver, so the
        // whole sheet moves up and its stops are measured against what you can
        // actually see. 4.75rem, not 4rem: the nav's centre action sticks up past
        // the bar itself, and at 4rem it sat on top of the sheet's first row.
        // z-45 on a phone: above the floating toolbar and search block (both
        // z-40), so raising the sheet doesn't leave them painting over the first
        // card in the list — but below the bottom nav's z-48. This used to be
        // z-50, which beat the nav too: the offset above only moves the sheet's
        // *position* clear of the nav, it says nothing about paint order once a
        // drag or a tall stop brings the two boxes' edges back together, and at
        // z-50 the sheet won that overlap and rode over the nav bar. The nav is
        // this app's one fixed piece of chrome and has to stay the top layer on
        // every route, so it, not the sheet, gets the higher number. On desktop
        // it is a panel beside the toolbar, not over it, so it drops to lg:z-30.
        "fixed inset-x-0 z-[45] flex flex-col rounded-t-3xl border-t border-border bg-card shadow-[0_-8px_30px_rgba(0,0,0,0.18)] lg:z-30",
        // Desktop: not a sheet at all. `!` beats the inline height below.
        // Desktop: still not a sheet, but no longer a bare block either. It is the
        // scrolling body of the floating panel that sits over the map, so it keeps
        // a surface of its own and takes the leftover height.
        "lg:!static lg:!bottom-auto lg:!h-auto lg:min-h-0 lg:!flex-1 lg:!transform-none lg:!transition-none lg:rounded-2xl lg:border lg:border-border lg:bg-card/90 lg:shadow-xl lg:backdrop-blur-xl lg:!pb-0",
        className,
      )}
      style={{
        // Moved out of the Tailwind class list and into here so it shares one
        // source (NAV_CLEARANCE) with the height cap below — the two used to be
        // written out separately and only one of them got updated.
        bottom: NAV_CLEARANCE,
        // min() caps the tallest stop: 0.92 is a fraction of the *whole*
        // viewport, but the sheet's bottom already eats NAV_CLEARANCE off the
        // top of that space, so 92dvh alone runs the sheet's top edge off the
        // screen. Worked out for a 700px-tall viewport (required test height)
        // with zero safe-area inset: 92dvh is 644px, but only 624px is actually
        // free above the offset (700 - 76) — 20px of the sheet's top, including
        // the drag handle, would sit above y=0 with no way to scroll it into
        // view. The cap keeps the top at y=0 in that case instead.
        height: `min(${heightVh}dvh, calc(100dvh - ${NAV_CLEARANCE}))`,
        // Follow the finger while dragging, then let the height transition take
        // over. Transitioning during a drag makes it feel laggy.
        transform: dragOffset ? `translateY(${Math.max(0, dragOffset)}px)` : undefined,
        transition: dragOffset ? "none" : "height 260ms cubic-bezier(0.16,1,0.3,1), transform 260ms cubic-bezier(0.16,1,0.3,1)",
        // No bottom inset needed any more: the sheet is positioned above the
        // nav rather than behind it (see the class list).
        paddingBottom: 0,
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
          "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-1.5 scroll-pt-2",
          "lg:overflow-y-auto lg:px-3 lg:py-2",
          // Collapsed, the content is a hint of what is below rather than
          // something to scroll — letting it scroll at 16dvh just traps a
          // finger meant for the map.
          // Only while it is a sheet — on desktop the list is the column.
          // NOT lg:overflow-visible. `stop` is a phone concept — on desktop the
          // sheet is a static panel and stays at 0 forever, so that escape hatch
          // applied permanently and let 4,665px of list spill out of a 642px
          // panel. The overflow then landed on the page column, which is
          // overflow:hidden, so a focus could scroll the toolbar off the top
          // with no scrollbar to bring it back.
          stop === 0 && "pointer-events-none overflow-hidden opacity-60 lg:pointer-events-auto lg:overflow-y-auto lg:opacity-100",
        )}
      >
        {children}
      </div>
    </div>
  );
}
