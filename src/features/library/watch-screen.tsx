"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ExternalLink,
  ListMusic,
  Loader2,
  PictureInPicture2,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { SmartBackLink } from "@/components/marketing/smart-back-link";
import { previousRoute } from "@/components/navigation/route-trail";
import { useNowPlaying, type NowPlayingItem } from "./now-playing-context";
import { toNowPlayingItem } from "./media-card";
import { ListenTogetherControls } from "./listen-together-controls";
import { setPlayerSlot } from "./player-slot";
import { WatchPlaylist } from "./watch-playlist";

const KIND_LABEL: Record<NowPlayingItem["kind"], string> = {
  music: "Nhạc",
  food_video: "Video nấu ăn",
  recipe: "Công thức",
  game: "Trò chơi",
};

/**
 * The watch page's client half: the player box on the left, the playlist on
 * the right, the title and controls under the video.
 *
 * It renders no frame of its own. It registers a box (`setPlayerSlot`) and
 * the floating dock — mounted above the router, owner of the only iframe in
 * the app — lays itself over that box. That is what lets a song carry on
 * unbroken when the person leaves this page: nothing is unmounted, the same
 * element only changes where it sits.
 */
export function WatchScreen({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    playing,
    queue,
    index,
    total,
    position,
    hasPrev,
    hasNext,
    start,
    next,
    prev,
    jumpTo,
    listen,
  } = useNowPlaying();

  /*
   * The list is only fetched when the queue does not know this id — a reload,
   * a link pasted from elsewhere. Coming from a card, the queue already holds
   * the whole tab and nothing is requested.
   */
  const inQueue = queue.some((q) => q.id === id);
  const list = trpc.media.list.useQuery(undefined, { enabled: !inQueue });

  /*
   * The URL and the playback are kept in step, and which one leads depends on
   * whether they have ever agreed.
   *
   * Before they have — a fresh load, a pasted link, a back/forward step — the
   * URL is the instruction and the player is made to match it. After they
   * have, this page is a view of whatever is playing, so a skip, a playlist
   * pick or the partner moving the shared session rewrites the URL.
   *
   * Getting that order wrong was visible: with a live shared session, opening
   * a track outside it bounced straight back to the session's track, because
   * the first non-null `playing` — the session being adopted a moment after
   * mount — was read as "the playback moved, follow it".
   *
   * The rewrite goes through the history API, NOT the router. A dynamic
   * segment is part of the route, so `router.replace` to another track
   * REMOUNTS this page: the box the player sits in is unregistered and
   * registered again, and for as long as that takes the frame falls back to
   * its floating corner. That is what made every skip — a button here, a
   * playlist pick, or the other person moving the shared session — throw both
   * sides out of the large player and into the small window, and what left
   * the page in a state where its own expand button had nothing to open.
   * Rewriting the address alone keeps the page, the box and the frame exactly
   * where they are, and the link still names the track that is playing.
   */
  const seen = useRef({ id, agreed: false });
  useEffect(() => {
    const s = seen.current;
    const pid = playing?.id ?? null;

    /** Make the player match the URL: from the queue, or from the library. */
    const adopt = () => {
      const at = queue.findIndex((q) => q.id === id);
      if (at >= 0) {
        jumpTo(at);
        return;
      }
      const items = list.data;
      if (!items) return;
      const wanted = items.find((i) => i.id === id);
      if (!wanted) return;
      /*
       * The same queue a card on the library tab would have handed over —
       * which means the same provider as well as the same kind. Filtering on
       * kind alone quietly put the mixture back: a reload of this page rebuilt
       * a queue with the tab's TikToks in it, so skipping landed on something
       * the dock cannot drive and a shared session cannot follow.
       */
      const sameTab = items
        .filter((i) => i.kind === wanted.kind && i.provider === wanted.provider)
        .map(toNowPlayingItem)
        .filter((q): q is NowPlayingItem => q !== null);
      const idx = sameTab.findIndex((q) => q.id === id);
      if (idx < 0) return;
      start(sameTab, idx);
    };

    if (id !== s.id) {
      // A real navigation — the URL is an instruction again.
      s.id = id;
      s.agreed = false;
    }

    if (pid === id) {
      s.agreed = true;
      return;
    }
    if (!s.agreed) {
      adopt();
      return;
    }
    if (pid) {
      const next = `/library/phat/${pid}`;
      if (window.location.pathname !== next)
        window.history.replaceState(null, "", next);
    }
  }, [id, playing, queue, list.data, jumpTo, start]);

  /*
   * The player was closed — the X on the floating window, or the last track
   * removed. There is nothing for this page to show, and it showed exactly
   * that: "Đang mở…" with a spinner, for ever. It leaves instead.
   */
  const closed = seen.current.agreed && total === 0;
  useEffect(() => {
    if (!closed) return;
    router.push(previousRoute(pathname) ?? "/library");
  }, [closed, router, pathname]);

  // Registered as a callback ref so the box is known the moment it exists.
  const slotRef = useCallback(
    (el: HTMLDivElement | null) => setPlayerSlot(el),
    [],
  );
  useEffect(() => () => setPlayerSlot(null), []);

  const shrink = () => router.push(previousRoute(pathname) ?? "/library");

  const item = playing;
  const controllable =
    item?.embed.provider === "youtube" && Boolean(item.embed.embedUrl);
  const canListen = Boolean(item && controllable && listen?.enabled);
  const missing =
    !inQueue && list.isSuccess && !list.data.some((i) => i.id === id);

  return (
    /*
     * Every block is a grid item of its own, not grouped into a left column.
     * On a phone the video is `sticky`, and a sticky element can travel only
     * within its parent: grouped, it would stop at the end of the left column
     * — just where the playlist begins, the one part worth scrolling under it.
     * With the grid as the parent it stays pinned for the whole page.
     */
    <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_auto_1fr] lg:items-start lg:gap-x-6 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="mb-3 flex items-center justify-between gap-3 lg:col-start-1 lg:row-start-1">
        <SmartBackLink fallback="/library" tone="app" />
        <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          {item ? KIND_LABEL[item.kind] : "Bộ sưu tập"}
        </span>
      </div>

      {/* On a phone the video stays put while the playlist scrolls under it,
            like the YouTube app. From lg up the two columns share the height
            and nothing needs pinning. */}
      <div className="bg-background sticky top-0 z-30 -mx-[var(--page-gutter)] px-[var(--page-gutter)] pb-2 lg:static lg:col-start-1 lg:row-start-2 lg:mx-0 lg:px-0 lg:pb-0">
        <div
          ref={slotRef}
          data-watch-slot=""
          className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-[0_18px_50px_rgba(0,0,0,0.28)]"
        >
          {/* What shows in the box before the frame arrives, and behind it. */}
          {item?.thumbnailUrl && (
            <img
              src={item.thumbnailUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-60"
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center text-white/80">
            {missing ? (
              <p className="px-6 text-center text-sm">
                Bài này không còn trong bộ sưu tập.
              </p>
            ) : !item || !item.embed.embedUrl ? (
              <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 min-w-0 lg:col-start-1 lg:row-start-3">
        <h1 className="text-foreground text-xl leading-snug font-bold sm:text-2xl [text-wrap:balance]">
          {item?.title ?? (missing ? "Không tìm thấy" : "Đang mở…")}
        </h1>
        {item && (
          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 text-sm">
            <span>{item.providerLabel}</span>
            {total > 1 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  Bài {position}/{total}
                </span>
              </>
            )}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={shrink}
            className="bg-accent text-accent-foreground hover:bg-accent/90 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition-colors"
          >
            <PictureInPicture2 className="h-4 w-4" aria-hidden="true" />
            Thu nhỏ, nghe tiếp
          </button>
          {total > 1 && (
            <div className="border-border bg-card inline-flex items-center rounded-full border shadow-sm">
              <button
                type="button"
                onClick={prev}
                disabled={!hasPrev}
                aria-label="Bài trước"
                className="text-foreground hover:bg-muted flex h-9 w-10 items-center justify-center rounded-l-full transition-colors disabled:opacity-40"
              >
                <SkipBack className="h-4 w-4" />
              </button>
              <span className="bg-border h-5 w-px" aria-hidden="true" />
              <button
                type="button"
                onClick={next}
                disabled={!hasNext}
                aria-label="Bài sau"
                className="text-foreground hover:bg-muted flex h-9 w-10 items-center justify-center rounded-r-full transition-colors disabled:opacity-40"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>
          )}
          {item?.embed.url && (
            <a
              href={item.embed.url}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border bg-card text-foreground hover:bg-muted inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium shadow-sm transition-colors"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Mở trên {item.providerLabel}
            </a>
          )}
        </div>

        {canListen && item && listen && (
          <div className="mt-3 max-w-sm">
            <ListenTogetherControls
              listen={listen}
              queue={queue}
              index={index}
              size="md"
              getState={() => {
                const r = listen.positionReader.current?.();
                return {
                  positionSec: r?.positionSec ?? 0,
                  isPlaying: r?.isPlaying ?? false,
                };
              }}
            />
          </div>
        )}
      </div>

      {/* From lg up the card takes the height of the screen — the list scrolls
          inside it and fades at the edges — and stays put should the left
          side ever be the taller one. A card the height of its six rows
          looked cut short next to the video. */}
      <aside className="mt-6 min-w-0 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:mt-0 lg:self-start">
        <div
          data-watch-playlist=""
          className="border-border bg-card flex flex-col overflow-hidden rounded-2xl border shadow-sm lg:h-[calc(100dvh-3rem)]"
        >
          <div className="border-border flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
            <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
              <ListMusic className="text-accent h-4 w-4" aria-hidden="true" />
              Danh sách phát
            </h2>
            {total > 0 && (
              <span className="text-muted-foreground text-xs tabular-nums">
                {position}/{total}
              </span>
            )}
          </div>
          <WatchPlaylist queue={queue} index={index} onPick={jumpTo} />
        </div>
      </aside>
    </div>
  );
}
