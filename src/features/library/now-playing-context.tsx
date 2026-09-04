"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { EmbedData } from "@/components/ui/embed-player";
import type { MediaListItem } from "./media-card";
import { NowPlayingDock } from "./now-playing-dock";

/**
 * What is playing, and the frame it plays in.
 *
 * The player lives above the router so it survives every navigation inside the
 * app. An iframe cannot be moved to a new parent without reloading from zero,
 * so keeping it in the media card meant leaving the library killed the music.
 * The card hands over what to play; this owns the only frame.
 *
 * Nothing here observes real playback. These are cross-origin YouTube /
 * Spotify / TikTok frames with no postMessage bridge, so "playing" means "this
 * is the frame that is mounted", which is the honest claim.
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

  const start = useCallback((queue: NowPlayingItem[], at: number) => {
    setState({ queue, index: Math.max(0, Math.min(at, queue.length - 1)) });
  }, []);

  const close = useCallback(() => setState(EMPTY), []);

  const step = useCallback((by: number) => {
    setState((s) => ({ ...s, index: Math.max(0, Math.min(s.index + by, s.queue.length - 1)) }));
  }, []);
  const next = useCallback(() => step(1), [step]);
  const prev = useCallback(() => step(-1), [step]);

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
      <NowPlayingDock
        item={value.playing}
        position={value.position}
        total={value.total}
        hasPrev={value.hasPrev}
        hasNext={value.hasNext}
        onPrev={prev}
        onNext={next}
        onClose={close}
      />
    </NowPlayingContext.Provider>
  );
}
