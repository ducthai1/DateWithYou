"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { EmbedData } from "@/components/ui/embed-player";
import type { MediaListItem } from "./media-card";
import { NowPlayingDock } from "./now-playing-dock";
import { useListenTogether } from "./use-listen-together";
import { ListenInviteModal } from "./listen-invite-modal";
import type { ListenTrack } from "@/features/locations/use-navigation-invites";

/**
 * What is playing, and the frame it plays in.
 *
 * The player lives above the router so it survives every navigation inside the
 * app. An iframe cannot be moved to a new parent without reloading from zero,
 * so keeping it in the media card meant leaving the library killed the music.
 * The card hands over what to play; this owns the only frame.
 *
 * Nothing here observes real playback for Spotify / TikTok / Instagram — those
 * are cross-origin frames with no usable bridge, so "playing" means "this is
 * the frame that is mounted", which is the honest claim. YouTube is the one
 * exception (see use-youtube-playback), and it is why shared listening only
 * offers itself for YouTube.
 *
 * When a shared session is live this provider also follows the partner's queue:
 * WHAT is playing is decided here, while play/pause and the playhead belong to
 * the dock, which owns the frame.
 */

export type NowPlayingItem = {
  id: string;
  kind: MediaListItem["kind"];
  title: string;
  thumbnailUrl: string | null;
  providerLabel: string;
  embed: EmbedData;
};

/** Queue and cursor move together: every change is one atomic update. */
type QueueState = { queue: NowPlayingItem[]; index: number };

type NowPlayingContextValue = {
  playing: NowPlayingItem | null;
  /** 1-based, for the "3/12" counter in the window. */
  position: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  /** The whole visible list is handed over, so skipping never needs the page. */
  start: (queue: NowPlayingItem[], index: number) => void;
  next: () => void;
  prev: () => void;
  stop: (id: string) => void;
  close: () => void;
};

const EMPTY: QueueState = { queue: [], index: 0 };

/** The player's item as it travels to the other device. */
export function toListenTrack(item: NowPlayingItem): ListenTrack {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    thumbnailUrl: item.thumbnailUrl,
    providerLabel: item.providerLabel,
    provider: item.embed.provider,
    embedUrl: item.embed.embedUrl ?? "",
  };
}

/** …and back again on the other side. */
function fromListenTrack(t: ListenTrack): NowPlayingItem {
  return {
    id: t.id,
    kind: t.kind as MediaListItem["kind"],
    title: t.title,
    thumbnailUrl: t.thumbnailUrl,
    providerLabel: t.providerLabel,
    embed: {
      provider: t.provider as EmbedData["provider"],
      url: t.embedUrl,
      embedUrl: t.embedUrl,
      thumbnailUrl: t.thumbnailUrl,
      title: t.title,
    },
  };
}

/** Same tracks in the same order? Cheap identity check for a queue swap. */
const sameQueue = (a: readonly NowPlayingItem[], b: readonly ListenTrack[]) =>
  a.length === b.length && a.every((x, i) => x.id === b[i].id);

const NowPlayingContext = createContext<NowPlayingContextValue>({
  playing: null,
  position: 0,
  total: 0,
  hasPrev: false,
  hasNext: false,
  start: () => {},
  next: () => {},
  prev: () => {},
  stop: () => {},
  close: () => {},
});

export function useNowPlaying() {
  return useContext(NowPlayingContext);
}

export function NowPlayingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<QueueState>(EMPTY);
  const listen = useListenTogether();

  const start = useCallback((queue: NowPlayingItem[], at: number) => {
    setState({ queue, index: Math.max(0, Math.min(at, queue.length - 1)) });
  }, []);

  const close = useCallback(() => setState(EMPTY), []);

  /*
   * A skip is reported, not just applied.
   *
   * The index is computed inside the updater — the only place the current one
   * is knowable without staleness — and handed out afterwards so the report
   * carries the same number the player moved to.
   */
  const step = useCallback(
    (by: number) => {
      let moved: number | null = null;
      setState((s) => {
        const at = Math.max(0, Math.min(s.index + by, s.queue.length - 1));
        if (at !== s.index) moved = at;
        return { ...s, index: at };
      });
      if (moved !== null) listen.report({ index: moved, positionSec: 0, isPlaying: true });
    },
    [listen],
  );
  const next = useCallback(() => step(1), [step]);
  const prev = useCallback(() => step(-1), [step]);

  /*
   * Follow the other person's queue.
   *
   * Only WHAT is playing: their play/pause and playhead reach the frame in the
   * dock, which is the only thing that can act on them. Guarded on identity so
   * an unchanged queue never re-mounts the iframe — that would restart the
   * track from zero on every state message.
   */
  const appliedState = useRef<string | null>(null);
  useEffect(() => {
    const ps = listen.partnerState;
    if (!ps || !listen.live) return;
    const stamp = `${ps.id}:${ps.index}:${ps.queue.map((t) => t.id).join(",")}`;
    if (appliedState.current === stamp) return;
    appliedState.current = stamp;
    setState((s) => {
      if (sameQueue(s.queue, ps.queue)) {
        return s.index === ps.index ? s : { ...s, index: ps.index };
      }
      return { queue: ps.queue.map(fromListenTrack), index: ps.index };
    });
  }, [listen.partnerState, listen.live]);

  /** A card was deleted. Close if it was the one playing, otherwise just drop
   *  it from the queue and keep the cursor on the same track. */
  const stop = useCallback((id: string) => {
    setState((s) => {
      const at = s.queue.findIndex((q) => q.id === id);
      if (at < 0) return s;
      if (at === s.index) return EMPTY;
      return { queue: s.queue.filter((q) => q.id !== id), index: at < s.index ? s.index - 1 : s.index };
    });
  }, []);

  const value = useMemo<NowPlayingContextValue>(() => {
    const playing = state.queue[state.index] ?? null;
    return {
      playing,
      position: playing ? state.index + 1 : 0,
      total: state.queue.length,
      hasPrev: state.index > 0,
      hasNext: state.index < state.queue.length - 1,
      start,
      next,
      prev,
      stop,
      close,
    };
  }, [state, start, next, prev, stop, close]);

  return (
    <NowPlayingContext.Provider value={value}>
      {children}
      {/* Mounted here, not beside GlobalInviteListener, because the session
          hook holds state (live, waiting, the last known playhead) and a second
          call to it elsewhere would be a second, diverging copy. */}
      {listen.invite && (
        <ListenInviteModal
          trackTitle={listen.invite.title}
          isPending={listen.isBusy}
          onAccept={() => void listen.respond(true)}
          onDecline={() => void listen.respond(false)}
        />
      )}
      <NowPlayingDock
        item={value.playing}
        position={value.position}
        total={value.total}
        hasPrev={value.hasPrev}
        hasNext={value.hasNext}
        onPrev={prev}
        onNext={next}
        onClose={close}
        listen={listen}
        queue={state.queue}
        index={state.index}
      />
    </NowPlayingContext.Provider>
  );
}
