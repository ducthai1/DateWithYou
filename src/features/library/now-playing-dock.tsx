"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChefHat, Music2, Pause, Play, SkipBack, SkipForward, Video, X } from "lucide-react";
import { EmbedPlayer, EMBED_ASPECT, SPOTIFY_BAR_HEIGHT } from "@/components/ui/embed-player";
import { cn } from "@/lib/utils";
import type { MediaListItem } from "./media-card";
import type { NowPlayingItem } from "./now-playing-context";
import { useFloatingWindow, type DragMode } from "./use-floating-window";
import { useYouTubePlayback, withJsApi } from "./use-youtube-playback";

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
/**
 * Toolbar height, and the widths it changes at. Declared once and applied as
 * an explicit height, because the corner-resize anchor computes the panel
 * height from these — a value that drifted from the CSS would slide the panel.
 *
 * Below NARROW_W the four buttons leave the title a few pixels, so the row
 * splits in two.
 */
const BAR_H = 52;
const BAR_H_NARROW = 84;
/* 340, not 268: at the 320 default the single row left ~100px for the text and
   cut "YouTube · 2/3" down to "YouTube · 2…". Above this width the one-row
   layout has room for the whole line. */
const NARROW_W = 340;
const barHeightFor = (w: number) => (w < NARROW_W ? BAR_H_NARROW : BAR_H);
const AUTONEXT_KEY = "vivu.nowplaying.autonext";

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

  /*
   * Play/pause talks to the frame directly, so it needs the frame. Reaching
   * for it through the media box keeps EmbedPlayer's shape unchanged — it is
   * used by the cards too, which have nothing to control.
   */
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const getFrame = useCallback(() => mediaRef.current?.querySelector("iframe") ?? null, []);
  const controllable = item?.embed.provider === "youtube" && Boolean(item.embed.embedUrl);

  /*
   * Play the next track when this one runs out, if the switch is on. Read
   * through refs: the handler is held by the frame's message listener for the
   * life of the track, and a captured value would be the one from whenever the
   * track started.
   */
  const [autoNext, setAutoNext] = useState(false);
  const autoNextRef = useRef(false);
  autoNextRef.current = autoNext;
  const hasNextRef = useRef(hasNext);
  hasNextRef.current = hasNext;
  const itemIdRef = useRef<string | null>(null);
  itemIdRef.current = item?.id ?? null;
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;
  /**
   * Which track ran out, when the skip was automatic.
   *
   * Holding the id rather than a flag is what keeps the start on the right
   * frame: readiness lags a track change by a render, so a plain flag was spent
   * on the outgoing frame and the new one was never told to play. The next
   * track's id is not known here, but "any track that is not the one that
   * ended" is enough.
   */
  const endedTrack = useRef<string | null>(null);

  useEffect(() => {
    try {
      setAutoNext(window.localStorage.getItem(AUTONEXT_KEY) === "1");
    } catch {
      /* Private mode — the switch just starts off. */
    }
  }, []);

  const handleEnded = useCallback(() => {
    if (!autoNextRef.current || !hasNextRef.current) return;
    endedTrack.current = itemIdRef.current;
    onNextRef.current();
  }, []);

  const playback = useYouTubePlayback(getFrame, controllable, item?.id ?? "", handleEnded);

  useEffect(() => {
    const ended = endedTrack.current;
    if (!ended || !playback.readyFor || playback.readyFor === ended) return;
    endedTrack.current = null;
    playback.play();
  }, [playback]);

  const toggleAutoNext = useCallback(() => {
    setAutoNext((on) => {
      const next = !on;
      try {
        window.localStorage.setItem(AUTONEXT_KEY, next ? "1" : "0");
      } catch {
        /* Not remembered, still applies for this session. */
      }
      return next;
    });
  }, []);
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
    heightFor: (w) => BORDER + STRIP_H + mediaHeightFor(w) + barHeightFor(w) + PAD,
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

  const barH = barHeightFor(box.w);
  const narrow = box.w < NARROW_W;

  const skipButton =
    "text-muted-foreground hover:bg-muted hover:text-foreground pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-30 disabled:hover:bg-transparent";

  const info = (
    <>
      {/* Dropped on a narrow panel: it carries no information the frame above
          does not, and the switch beside the name needs those 38px more than
          decoration does — with it there, "YouTube · 1/3" was being cut. */}
      {!narrow && (
        <span className="bg-accent-soft text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item?.title}</p>
        <p className="text-muted-foreground truncate text-xs">
          {total > 1 ? `${item?.providerLabel} · ${position}/${total}` : item?.providerLabel}
        </p>
      </div>
      {/* Beside the track name, centred against its two lines — not up on the
          title strip, which exists to drag the window and nothing else. */}
      {controllable && (
        <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
          <span className="text-muted-foreground text-[10px] leading-none font-medium">Tự phát</span>
          <button
            type="button"
            role="switch"
            aria-checked={autoNext}
            aria-label="Tự phát bài tiếp theo khi hết bài"
            onClick={toggleAutoNext}
            className={cn(
              "focus-visible:ring-ring relative h-[15px] w-[26px] shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
              autoNext ? "bg-accent" : "bg-muted-foreground/35",
            )}
          >
            <span
              className={cn(
                "absolute top-[2px] h-[11px] w-[11px] rounded-full bg-white shadow-sm transition-[left] duration-200",
                autoNext ? "left-[13px]" : "left-[2px]",
              )}
            />
          </button>
        </div>
      )}
    </>
  );

  const controls = (
    <>
      <button type="button" onClick={onPrev} disabled={!hasPrev} aria-label="Bài trước" className={skipButton}>
        <SkipBack className="h-4 w-4" />
      </button>
      {/* Only where the frame can actually be driven — a dead play button is
          worse than no play button. */}
      {controllable && (
        <button
          type="button"
          onClick={playback.toggle}
          aria-label={playback.playing ? "Tạm dừng" : "Phát"}
          aria-pressed={playback.playing}
          className={cn(skipButton, "bg-accent-soft text-accent hover:bg-accent hover:text-white")}
        >
          {playback.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
      )}
      <button type="button" onClick={onNext} disabled={!hasNext} aria-label="Bài sau" className={skipButton}>
        <SkipForward className="h-4 w-4" />
      </button>
      <button type="button" onClick={onClose} aria-label="Đóng trình phát" className={skipButton}>
        <X className="h-4 w-4" />
      </button>
    </>
  );

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
              /* Above the title strip: that strip is `relative` so it can hold
                 the switch, which made it paint over both top corners and swallow
                 their grips. */
              className={cn("absolute z-10 h-6 w-6", c.className)}
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
            /* Nothing but the drag surface. Controls belong beside the track
               name below, where the eye already is. */
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
                ref={mediaRef}
                className="bg-muted mx-auto overflow-hidden rounded-xl"
                style={{ width: mediaW, height: mediaH }}
              >
                {/*
                  Keyed by track, so a change mounts a fresh frame instead of
                  pointing the old one at a new video. Reusing it left the
                  previous player's trailing state messages arriving on the
                  same window — enough to look like the new player had
                  answered, which stopped the handshake before the new one was
                  listening. From there nothing could be told to play.
                */}
                <EmbedPlayer
                  key={item.id}
                  data={
                    controllable
                      ? { ...item.embed, embedUrl: withJsApi(item.embed.embedUrl!, window.location.origin) }
                      : item.embed
                  }
                  fill
                />
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
            <div
              className="pointer-events-none relative z-10 flex items-center pt-2"
              style={{ height: barH }}
            >
              {narrow ? (
                <div className="flex w-full min-w-0 flex-col gap-1">
                  <div className="flex min-w-0 items-center gap-1.5">{info}</div>
                  <div className="flex items-center justify-center gap-1">{controls}</div>
                </div>
              ) : (
                <div className="flex w-full min-w-0 items-center gap-1.5">
                  {info}
                  {controls}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
