"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChefHat, Music2, SkipBack, SkipForward, Video, X } from "lucide-react";
import { EmbedPlayer, EMBED_ASPECT, SPOTIFY_BAR_HEIGHT } from "@/components/ui/embed-player";
import { cn } from "@/lib/utils";
import type { MediaListItem } from "./media-card";
import type { NowPlayingItem } from "./now-playing-context";
import { useFloatingWindow, type DragMode } from "./use-floating-window";

const KIND_ICON: Record<MediaListItem["kind"], typeof Music2> = {
  music: Music2,
  food_video: Video,
  recipe: ChefHat,
  game: Music2, // games have no url and never reach the dock; kept exhaustive
};

const MIN_W = 180;
const MAX_W = 640;
/** Inset around the frame, so the panel's own edge stays visible. */
const PAD = 6;
/** Fixed parts of the panel's height, so it can be computed from the width
 *  alone: 1px border each side, the title strip, and the toolbar row. */
const BORDER = 2;
const STRIP_H = 24;
const BAR_H = 52;

const CORNERS: Array<{ mode: Exclude<DragMode, "move">; className: string; label: string }> = [
  { mode: "nw", className: "top-0 left-0 cursor-nwse-resize", label: "trên trái" },
  { mode: "ne", className: "top-0 right-0 cursor-nesw-resize", label: "trên phải" },
  { mode: "sw", className: "bottom-0 left-0 cursor-nesw-resize", label: "dưới trái" },
  { mode: "se", className: "right-0 bottom-0 cursor-nwse-resize", label: "dưới phải" },
];

function useViewportHeight() {
  const [h, setH] = useState(0);
  useEffect(() => {
    const read = () => setH(window.innerHeight);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return h;
}

/** The floating player. Portalled to the body so no page's stacking traps it. */
export function NowPlayingDock({
  item,
  position,
  total,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
}: {
  item: NowPlayingItem | null;
  position: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const viewportH = useViewportHeight();
  const aspect = item ? EMBED_ASPECT[item.embed.provider] : null;
  const capH = Math.max(140, Math.round((viewportH || 640) * 0.5));

  /** The frame's height for a width — the one rule both the layout below and a
   *  corner pull's bottom-edge anchor read from. */
  const mediaHeightFor = (w: number) => {
    const h = aspect ? Math.round((w - PAD * 2) / aspect) : SPOTIFY_BAR_HEIGHT;
    return aspect && h > capH ? capH : h;
  };

  const { boxRef, box, moveProps, cornerProps } = useFloatingWindow({
    storageKey: "vivu.nowplaying.window",
    minWidth: MIN_W,
    maxWidth: MAX_W,
    heightFor: (w) => BORDER + STRIP_H + mediaHeightFor(w) + BAR_H + PAD,
  });

  if (!mounted || !box) return null;

  const Icon = item ? KIND_ICON[item.kind] : Music2;
  const embeddable = Boolean(item?.embed.embedUrl);

  /*
   * The frame's box, worked out here rather than by the provider defaults: the
   * window owns its width, and a fixed provider height would either clip the
   * frame or leave dead space around it.
   *
   * A vertical clip (TikTok, Reels) is capped at half the viewport and the box
   * narrows to match, so the aspect holds instead of the video getting cropped
   * — the old dock let one grow to 740px and swallow a phone screen whole.
   */
  const mediaH = mediaHeightFor(box.w);
  // A capped vertical clip narrows instead of being cropped.
  const mediaW = aspect && mediaH === capH ? Math.round(capH * aspect) : box.w - PAD * 2;

  const skipButton =
    "text-muted-foreground hover:bg-muted hover:text-foreground pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-30 disabled:hover:bg-transparent";

  return createPortal(
    <AnimatePresence>
      {item && (
        <motion.div
          key="now-playing"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
          ref={boxRef}
          role="region"
          aria-label={`Đang phát: ${item.title}`}
          style={box.x == null ? { width: box.w } : { width: box.w, left: box.x, top: box.y ?? 0 }}
          className={cn(
            /*
              No `overflow-hidden` here on purpose. With it, `rounded-2xl`
              clips the children's hit area to the rounded shape, and the few
              pixels nearest each corner stop responding — the corner people
              aim at to grab or resize the panel goes dead. The frame inside
              has its own rounding, so nothing needs clipping at this level.
            */
            "border-border bg-card fixed z-40 rounded-2xl border shadow-[0_10px_30px_rgba(0,0,0,0.25)]",
            // Parked above the bottom nav until the first drag moves it.
            box.x == null && "right-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:right-6 sm:bottom-6",
          )}
        >
          {/*
            Corner grips come first so the toolbar below paints over them, and
            they are deliberately square and unclipped: a `rounded-*` here
            clips a grip's own hit area, and the outermost corner — the one
            people aim at — falls through to the drag surface and moves the
            panel instead of sizing it.
          */}
          {CORNERS.map((c) => (
            <div
              key={c.mode}
              {...cornerProps(c.mode)}
              role="separator"
              aria-label={`Kéo góc ${c.label} để đổi cỡ`}
              style={{ touchAction: "none" }}
              className={cn("absolute h-6 w-6", c.className)}
            />
          ))}

          {/*
            Title strip: the drag surface, the full width of the panel. It used
            to be only the thin inset around the frame, which meant hunting for
            a few pixels of border before the window would move at all.
          */}
          <div
            {...moveProps}
            style={{ touchAction: "none" }}
            className="flex h-6 cursor-grab items-center justify-center rounded-t-2xl active:cursor-grabbing"
          >
            <span className="bg-muted-foreground/30 h-1 w-10 rounded-full" aria-hidden="true" />
          </div>

          <div
            {...moveProps}
            style={{ paddingLeft: PAD, paddingRight: PAD, paddingBottom: PAD, touchAction: "none" }}
            className="cursor-grab active:cursor-grabbing"
          >
            {embeddable ? (
              <div
                className="bg-muted mx-auto overflow-hidden rounded-xl"
                style={{ width: mediaW, height: mediaH }}
              >
                <EmbedPlayer data={item.embed} fill />
              </div>
            ) : (
              <EmbedPlayer data={item.embed} />
            )}

            {/*
              Always out. Hiding it behind a hover made the panel flicker open
              and shut as the pointer crossed it, and the bar that never hides
              on its own is YouTube's, inside the frame — not this one.

              `pointer-events-none` on the row with `auto` on its buttons keeps
              two things true at once: the buttons stay clickable, and the
              empty space beside them still drags the window instead of
              swallowing the gesture.
            */}
            <div className="pointer-events-none relative z-10 flex items-center gap-1.5 pt-2">
              <span className="bg-accent-soft text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {total > 1 ? `${item.providerLabel} · ${position}/${total}` : item.providerLabel}
                </p>
              </div>
              <button type="button" onClick={onPrev} disabled={!hasPrev} aria-label="Bài trước" className={skipButton}>
                <SkipBack className="h-4 w-4" />
              </button>
              <button type="button" onClick={onNext} disabled={!hasNext} aria-label="Bài sau" className={skipButton}>
                <SkipForward className="h-4 w-4" />
              </button>
              <button type="button" onClick={onClose} aria-label="Đóng trình phát" className={skipButton}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
