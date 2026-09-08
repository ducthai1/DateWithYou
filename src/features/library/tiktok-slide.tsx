"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Loader2, VolumeX } from "lucide-react";
import { tiktokPlayerUrl } from "@/lib/embed";
import { cn } from "@/lib/utils";
import type { MediaListItem } from "./media-card";
import {
  TIKTOK_INVALID_VIDEO,
  playerErrorCode,
  readPlayerEvent,
} from "./tiktok-player";

/**
 * One video of the feed.
 *
 * What the player should do is expressed entirely in its URL — play, loop,
 * sound — because that is the only channel to it that actually works; the
 * documented postMessage commands are inert (see tiktok-player). So the frame
 * is keyed on those settings: becoming the video on screen, or the sound being
 * switched, mounts a frame that is already doing the right thing, and the
 * video left behind is replaced by one that is paused. That is also why a
 * neighbour cannot be heard: its frame is built with autoplay off.
 *
 * Frames exist for the video on screen and its two neighbours, so a swipe
 * lands on a player that has already loaded while a list of thirty does not
 * open thirty players.
 */
export function TikTokSlide({
  item,
  postId,
  active,
  mounted,
  muted,
}: {
  item: MediaListItem;
  postId: string;
  active: boolean;
  /** Near enough to the screen to be worth a frame. */
  mounted: boolean;
  /** The feed's sound setting, so a swipe does not un-mute what was muted. */
  muted: boolean;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [gone, setGone] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const src = useMemo(
    () =>
      tiktokPlayerUrl(postId, {
        autoplay: active,
        muted: !active || muted,
        loop: true,
        /*
         * The player's own caption and music line are off: they land in the
         * same corner as the note and the tags written here, and two captions
         * over one video is a muddle. What the couple wrote about the clip is
         * the reason it is in their collection, so that is the one kept — the
         * creator's own words are a tap away under "Mở trên TikTok".
         */
        description: false,
        musicInfo: false,
      }),
    [postId, active, muted],
  );

  useEffect(() => {
    if (!mounted) setLoaded(false);
  }, [mounted]);
  useEffect(() => setLoaded(false), [src]);

  /*
   * The one thing the player does say: that there is nothing to play. A post
   * taken down, or made private, would otherwise sit on a spinner for ever.
   */
  useEffect(() => {
    const frame = frameRef.current;
    if (!mounted || !frame) return;
    const onMessage = (e: MessageEvent) => {
      const ev = readPlayerEvent(e, frame.contentWindow);
      if (!ev || ev.type !== "onPlayerError") return;
      if (playerErrorCode(ev.value) === TIKTOK_INVALID_VIDEO) setGone(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // Re-bound whenever the frame is rebuilt (the URL is its key), so the
    // window compared against is the one on screen and not a detached one.
  }, [mounted, src]);

  const state = gone ? "gone" : !mounted ? "idle" : active ? "active" : "ready";

  return (
    <li
      data-tiktok-slide={item.id}
      data-active={active ? "" : undefined}
      data-player-state={state}
      className="flex h-full snap-start snap-always items-center justify-center"
    >
      <div
        /* 9:16, as tall as the screen allows and never wider than it. */
        className="relative aspect-[9/16] w-full max-w-[min(100%,calc(100dvh*9/16))] overflow-hidden bg-neutral-950 sm:rounded-2xl"
      >
        {mounted && !gone && (
          <iframe
            // Keyed on what the URL asks for, so a change of either mounts a
            // frame that is already doing it.
            key={src}
            ref={frameRef}
            src={src}
            title={item.title}
            allow="autoplay; fullscreen"
            allowFullScreen
            onLoad={() => setLoaded(true)}
            className="absolute inset-0 h-full w-full border-0"
          />
        )}

        {gone && (
          <div className="absolute inset-0 grid place-items-center p-8 text-center">
            <p className="text-sm text-white/80">
              Video này không còn trên TikTok.
              <br />
              <a
                href={item.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 font-semibold text-white underline"
              >
                Mở link gốc <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </p>
          </div>
        )}

        {mounted && !gone && !loaded && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <Loader2
              className="h-7 w-7 animate-spin text-white/70"
              aria-hidden="true"
            />
          </div>
        )}

        {/* The player's own controls sit low in the frame, so the caption goes
            above them and stops short of the right edge where its sound and
            fullscreen buttons are. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-4 pr-20 pb-16">
          <p className="line-clamp-2 text-sm font-semibold text-white [text-wrap:balance]">
            {item.title}
          </p>
          {item.note && (
            <p className="mt-1 line-clamp-2 text-xs text-white/70">
              {item.note}
            </p>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              Mở trên TikTok
            </a>
          )}
          {item.tags.length > 0 && (
            <p className="mt-1.5 flex flex-wrap gap-1.5">
              {item.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white/90"
                >
                  #{t}
                </span>
              ))}
            </p>
          )}
        </div>

        {active && muted && (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-3 left-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white/85",
            )}
          >
            <VolumeX className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </li>
  );
}
