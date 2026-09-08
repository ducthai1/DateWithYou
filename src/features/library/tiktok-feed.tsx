"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { tiktokPostId } from "@/lib/embed";
import { previousRoute } from "@/components/navigation/route-trail";
import type { MediaListItem } from "./media-card";
import { TikTokSlide } from "./tiktok-slide";
import { requestPlayerPause } from "./player-command";

/**
 * The TikTok screen: one video at a time, full height, swiped vertically.
 *
 * Separate from the floating player by design, not by accident. The dock
 * exists to keep ONE frame alive across the whole app because music must not
 * stop when you change tab; a short video is the opposite — you swipe, it is
 * replaced, and nothing should survive. Sharing the dock's single-frame
 * machinery with it would have meant a queue that mixes two players, only one
 * of which can be controlled or kept in step with another phone, which is
 * where the conflicts came from. So: its own screen, its own protocol, its own
 * list. Nothing here touches YouTube playback except to ask it to pause, since
 * two soundtracks at once serves nobody.
 */
export function TikTokFeed({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const list = trpc.media.list.useQuery();
  const scrollerRef = useRef<HTMLOListElement | null>(null);

  /*
   * The list is the same one the card handed over: TikTok links of the same
   * kind, newest first — the library's own order. Videos without a post id
   * (a short vm.tiktok.com link) cannot be played and are left out rather
   * than left in as a slide that can only fail.
   */
  const items = useMemo(() => {
    const all = list.data ?? [];
    const wanted = all.find((i) => i.id === id);
    if (!wanted) return [];
    return all.filter(
      (i) =>
        i.provider === "tiktok" &&
        i.kind === wanted.kind &&
        tiktokPostId(i.url) !== null,
    ) as MediaListItem[];
  }, [list.data, id]);

  const startIndex = useMemo(() => {
    const at = items.findIndex((i) => i.id === id);
    return at < 0 ? 0 : at;
  }, [items, id]);

  const [active, setActive] = useState(0);
  /*
   * Set the moment the person asks to leave, and never unset.
   *
   * A push out of here is asynchronous — the route is fetched before the
   * address bar moves — so for a few frames this screen is still mounted and
   * still on its own URL. It re-lays-out on the way out, the observer reports
   * the first video, and the URL sync below wrote that video's address over
   * the pending navigation: the way out of the feed did nothing but jump to
   * the top of it. Checking `location.pathname` was not enough for exactly
   * that reason — it has not changed yet at that point.
   */
  const leaving = useRef(false);
  const [muted, setMuted] = useState(false);

  // Music and a video at once is nobody's idea of listening together.
  useEffect(() => {
    requestPlayerPause();
  }, []);

  // Open on the video that was pressed, without a scroll animation.
  const positioned = useRef(false);
  useEffect(() => {
    if (positioned.current || !items.length) return;
    positioned.current = true;
    setActive(startIndex);
    const el = scrollerRef.current?.children[startIndex] as
      HTMLElement | undefined;
    el?.scrollIntoView({ block: "start" });
  }, [items.length, startIndex]);

  // Whichever slide covers most of the screen is the one playing.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !items.length) return;
    const slides = Array.from(scroller.children) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const at = slides.indexOf(e.target as HTMLElement);
          if (at >= 0) setActive(at);
        }
      },
      { root: scroller, threshold: 0.6 },
    );
    slides.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [items.length]);

  /*
   * The address bar follows the swipe, so the link can be shared and a reload
   * lands on the same video — written with the history API rather than the
   * router, because a swipe is not a navigation: `router.replace` would fetch
   * the route again on every video and the feed would stutter under a thumb.
   */
  useEffect(() => {
    const item = items[active];
    if (!item) return;
    /*
     * Only while this screen is still the one on show. Leaving it was being
     * undone right here: the tap on "Bộ sưu tập" pushed /library, the feed
     * re-laid-out on its way out, the observer reported the first video, and
     * this wrote that video's address back over the navigation — so the way
     * out of the feed did nothing but jump to the top of it.
     */
    if (leaving.current) return;
    if (!window.location.pathname.startsWith("/library/luot/")) return;
    const next = `/library/luot/${item.id}`;
    if (window.location.pathname !== next)
      window.history.replaceState(null, "", next);
  }, [active, items]);

  const leave = useCallback(() => {
    leaving.current = true;
    router.push(previousRoute(pathname) ?? "/library");
  }, [router, pathname]);

  const goTo = useCallback(
    (at: number) => {
      const scroller = scrollerRef.current;
      const target = Math.max(0, Math.min(at, items.length - 1));
      const el = scroller?.children[target] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "start", behavior: "smooth" });
    },
    [items.length],
  );

  // Arrow keys and the mouse wheel, for the half of the world without a thumb.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === "j") {
        e.preventDefault();
        goTo(active + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "k") {
        e.preventDefault();
        goTo(active - 1);
      } else if (e.key === "m") {
        setMuted((m) => !m);
      } else if (e.key === "Escape") {
        leave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, goTo, leave]);

  const missing = list.isSuccess && items.length === 0;

  return (
    <div className="fixed inset-0 z-50 bg-black text-white">
      {/* Above the video, so the way out is never hidden behind the player. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent p-3">
        <button
          type="button"
          onClick={leave}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-2 text-sm font-semibold backdrop-blur-sm transition-colors hover:bg-white/25"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Bộ sưu tập
        </button>
        <div className="pointer-events-auto flex items-center gap-2">
          {items.length > 0 && (
            <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold tabular-nums backdrop-blur-sm">
              {active + 1}/{items.length}
            </span>
          )}
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Bật tiếng" : "Tắt tiếng"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25"
          >
            {muted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {list.isPending && (
        <div className="absolute inset-0 grid place-items-center">
          <Loader2
            className="h-8 w-8 animate-spin text-white/70"
            aria-hidden="true"
          />
        </div>
      )}

      {missing && (
        <div className="absolute inset-0 grid place-items-center p-8 text-center">
          <p className="text-sm text-white/80">
            Không tìm thấy video TikTok này trong bộ sưu tập.
            <br />
            <button
              type="button"
              onClick={leave}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 font-semibold"
            >
              Về Bộ sưu tập
            </button>
          </p>
        </div>
      )}

      <ol
        ref={scrollerRef}
        /* One video per screen: the snap is mandatory so a half-swipe still
           settles on a video, never between two. */
        className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none]"
      >
        {items.map((item, i) => (
          <TikTokSlide
            key={item.id}
            item={item}
            postId={tiktokPostId(item.url) as string}
            active={i === active}
            mounted={Math.abs(i - active) <= 1}
            muted={muted}
          />
        ))}
      </ol>

      {/* Mouse users get what a thumb gets. Hidden on touch, where the swipe
          is the whole interface. */}
      {items.length > 1 && (
        <div className="pointer-events-none absolute right-4 bottom-6 z-20 hidden flex-col gap-2 sm:flex">
          <button
            type="button"
            onClick={() => goTo(active - 1)}
            disabled={active === 0}
            aria-label="Video trước"
            className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25 disabled:opacity-30"
          >
            <ChevronUp className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            disabled={active === items.length - 1}
            aria-label="Video sau"
            className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25 disabled:opacity-30"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
