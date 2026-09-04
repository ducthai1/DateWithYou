"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChefHat, GripVertical, Music2, SkipBack, SkipForward, Video, X } from "lucide-react";
import { EmbedPlayer, EMBED_ASPECT, SPOTIFY_BAR_HEIGHT } from "@/components/ui/embed-player";
import { cn } from "@/lib/utils";
import type { MediaListItem } from "./media-card";
import type { NowPlayingItem } from "./now-playing-context";
import { useFloatingWindow } from "./use-floating-window";

const KIND_ICON: Record<MediaListItem["kind"], typeof Music2> = {
  music: Music2,
  food_video: Video,
  recipe: ChefHat,
  game: Music2, // games have no url and never reach the dock; kept exhaustive
};

const MIN_W = 180;
const MAX_W = 640;
/** Padding around the frame, so the panel's own edge stays visible. */
const PAD = 6;

/** Pointer capability, not screen width: a small laptop still hovers, a big
 *  tablet still does not. Drives whether the toolbar hides itself. */
function useCanHover() {
  const [can, setCan] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setCan(mq.matches);
    const onChange = () => setCan(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return can;
}

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
  const canHover = useCanHover();
  const viewportH = useViewportHeight();
  const { boxRef, box, moveProps, sizeProps } = useFloatingWindow({
    storageKey: "vivu.nowplaying.window",
    minWidth: MIN_W,
    maxWidth: MAX_W,
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
  const aspect = item ? EMBED_ASPECT[item.embed.provider] : null;
  const innerW = box.w - PAD * 2;
  const capH = Math.max(140, Math.round((viewportH || 640) * 0.5));
  let mediaW = innerW;
  let mediaH = aspect ? Math.round(innerW / aspect) : SPOTIFY_BAR_HEIGHT;
  if (aspect && mediaH > capH) {
    mediaH = capH;
    mediaW = Math.round(capH * aspect);
  }

  /* Hidden until hovered on a mouse, always out on a touch screen — there is
   * no hover there, so a toolbar that waits for one is a toolbar nobody gets. */
  const chrome = canHover
    ? "max-h-0 opacity-0 group-hover:max-h-24 group-hover:opacity-100 group-focus-within:max-h-24 group-focus-within:opacity-100"
    : "max-h-24 opacity-100";

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
            "group border-border bg-card fixed z-40 rounded-2xl border shadow-[0_10px_30px_rgba(0,0,0,0.25)]",
            // Parked above the bottom nav until the first drag moves it.
            box.x == null && "right-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:right-6 sm:bottom-6",
          )}
        >
          {/* The padding is the drag surface: an iframe swallows its own
              pointer events, so the panel can only be grabbed by its edge. */}
          <div
            {...moveProps}
            style={{ padding: PAD, touchAction: "none" }}
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

            <div className={cn("overflow-hidden transition-all duration-200", chrome)}>
              <div className="flex items-center gap-1.5 pt-2">
                <GripVertical className="text-muted-foreground/60 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="bg-accent-soft text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {total > 1 ? `${item.providerLabel} · ${position}/${total}` : item.providerLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onPrev}
                  disabled={!hasPrev}
                  aria-label="Bài trước"
                  className="text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:hover:bg-transparent"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!hasNext}
                  aria-label="Bài sau"
                  className="text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:hover:bg-transparent"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Đóng trình phát"
                  className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/*
            Resize grip. Bigger on touch, where there is no cursor to aim with.
            Deliberately square and unclipped: a `rounded-br` here clipped its
            own hit area, so the outermost corner — the one people aim at —
            fell through to the drag surface and moved the panel instead. The
            square has no background, only the small marker inside it, so it
            reaching past the rounded corner is invisible.
          */}
          <div
            {...sizeProps}
            role="separator"
            aria-label="Kéo để đổi cỡ khung"
            style={{ touchAction: "none" }}
            className={cn(
              "absolute right-0 bottom-0 cursor-se-resize",
              canHover ? "h-5 w-5 opacity-0 group-hover:opacity-100" : "h-7 w-7 opacity-70",
            )}
          >
            <span className="border-muted-foreground/50 absolute right-1.5 bottom-1.5 h-2 w-2 border-r-2 border-b-2" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
