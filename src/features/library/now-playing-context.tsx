"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { EmbedData } from "@/components/ui/embed-player";
import type { MediaListItem } from "./media-card";
import { NowPlayingDock } from "./now-playing-dock";
import { useListenTogether, type ListenTogether } from "./use-listen-together";
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
  /** The whole queue and where we are in it — the watch page draws its own list. */
  queue: readonly NowPlayingItem[];
  index: number;
  /** The whole visible list is handed over, so skipping never needs the page. */
  start: (queue: NowPlayingItem[], index: number) => void;
  next: () => void;
  prev: () => void;
  /** Go straight to a track in the current queue (a click on the playlist). */
  jumpTo: (index: number) => void;
  stop: (id: string) => void;
  close: () => void;
  /**
   * The shared session, so a card can offer "nghe cùng" without the dock
   * having to exist first — the owner did not want to press play and only
   * then be allowed to invite. One instance, held here, because the hook keeps
   * state; a second call to it elsewhere would be a second, diverging copy.
   */
  listen: ListenTogether | null;
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
  queue: [],
  index: 0,
  start: () => {},
  next: () => {},
  prev: () => {},
  jumpTo: () => {},
  stop: () => {},
  close: () => {},
  listen: null,
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

  /*
   * Closing the player ends the session too.
   *
   * It used to only empty the local queue: the document stayed "live", the
   * other person's dock kept saying "Đang nghe cùng", and they were now
   * listening together with nobody. One X, both sides told.
   */
  const close = useCallback(() => {
    setState(EMPTY);
    if (listen.live || listen.waiting) void listen.end();
  }, [listen]);

  /*
   * A skip is reported, not just applied.
   *
   * The index is computed inside the updater — the only place the current one
   * is knowable without staleness — and handed out afterwards so the report
   * carries the same number the player moved to.
   */
  const jumpTo = useCallback(
    (to: number) => {
      /*
       * Computed from the rendered state, not read back out of the updater:
       * React only runs a functional update eagerly when nothing else is
       * queued, so a variable assigned inside it could still be unset here.
       */
      const at = Math.max(0, Math.min(to, state.queue.length - 1));
      if (at === state.index) return;
      setState((s) => ({ ...s, index: at }));
      // The other side hears about a skip the same way as a pressed button.
      listen.report({ index: at, positionSec: 0, isPlaying: true });
    },
    [state.index, state.queue.length, listen],
  );
  const next = useCallback(() => jumpTo(state.index + 1), [jumpTo, state.index]);
  const prev = useCallback(() => jumpTo(state.index - 1), [jumpTo, state.index]);

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
    // Waiting counts: a host who reloaded mid-invite gets their dock back.
    if (!ps || !(listen.live || listen.waiting)) return;
    const stamp = `${ps.id}:${ps.index}:${ps.queue.map((t) => t.id).join(",")}`;
    if (appliedState.current === stamp) return;
    appliedState.current = stamp;
    setState((s) => {
      if (sameQueue(s.queue, ps.queue)) {
        return s.index === ps.index ? s : { ...s, index: ps.index };
      }
      return { queue: ps.queue.map(fromListenTrack), index: ps.index };
    });
  }, [listen.partnerState, listen.live, listen.waiting]);

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
      queue: state.queue,
      index: state.index,
      start,
      next,
      prev,
      jumpTo,
      stop,
      close,
      listen,
    };
  }, [state, start, next, prev, jumpTo, stop, close, listen]);

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
