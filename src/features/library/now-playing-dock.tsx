"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChefHat, Music2, Video, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaListItem } from "./media-card";

/**
 * "Now playing" for the library grid.
 *
 * There is no real audio/video element or player SDK anywhere in this app —
 * music, food videos and recipes all play inside a cross-origin YouTube /
 * Spotify / TikTok / Instagram <iframe> (see embed-player.tsx). This app has
 * no postMessage bridge or Web Playback SDK wired to those iframes, so it
 * cannot observe an actual play/pause/progress event from them. Faking that
 * signal would be worse than not having it.
 *
 * What IS real and observable: the user explicitly pressing play on a card
 * (media-card.tsx gates the embed behind a poster + play button specifically
 * so this click exists), or opening a recipe's player modal
 * (recipe-detail.tsx). Both call `start()` below. "Scrolled away" is a real
 * IntersectionObserver report for the grid case, and "closed the modal" for
 * the recipe case — the modal IS the recipe's only full view, so leaving it
 * is the recipe equivalent of an inline card scrolling off-screen.
 */

export type NowPlayingItem = {
  id: string;
  kind: MediaListItem["kind"];
  title: string;
  thumbnailUrl: string | null;
  providerLabel: string;
  /** Bring this item back into full view (scroll to it, or reopen its modal). */
  onReturn: () => void;
};

type NowPlayingContextValue = {
  playing: NowPlayingItem | null;
  showDock: boolean;
  start: (item: NowPlayingItem) => void;
  /** No-ops unless `id` is still the current item — guards against a producer
   *  that unmounted after a newer item already took over "now playing". */
  stop: (id: string) => void;
  setVisible: (id: string, visible: boolean) => void;
  dismiss: () => void;
};

const NOOP_VALUE: NowPlayingContextValue = {
  playing: null,
  showDock: false,
  start: () => {},
  stop: () => {},
  setVisible: () => {},
  dismiss: () => {},
};

// Default is a harmless no-op (matches the ToastContext pattern in
// components/ui/toast.tsx) so a stray call outside the provider does nothing
// instead of throwing.
const NowPlayingContext = createContext<NowPlayingContextValue>(NOOP_VALUE);

export function useNowPlaying() {
  return useContext(NowPlayingContext);
}

const KIND_ICON: Record<MediaListItem["kind"], typeof Music2> = {
  music: Music2,
  food_video: Video,
  recipe: ChefHat,
  game: Music2, // games never reach the dock (no url) — kept exhaustive for the type
};

export function NowPlayingProvider({ children }: { children: ReactNode }) {
  const [playing, setPlaying] = useState<NowPlayingItem | null>(null);
  const [visible, setVisibleState] = useState(true);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  // Callbacks below are stable (empty deps) so producers can pass them to
  // effects without re-subscribing; they read the latest "current item" id
  // through this ref instead of closing over `playing`.
  const playingIdRef = useRef<string | null>(null);
  useEffect(() => {
    playingIdRef.current = playing?.id ?? null;
  }, [playing]);

  const start = useCallback((item: NowPlayingItem) => {
    setPlaying(item);
    // The action that calls start() (a click, a modal opening) is itself
    // proof the item is in full view right now.
    setVisibleState(true);
    setDismissedId(null);
  }, []);

  const stop = useCallback((id: string) => {
    if (playingIdRef.current !== id) return;
    setPlaying(null);
  }, []);

  const setVisible = useCallback((id: string, next: boolean) => {
    if (playingIdRef.current !== id) return;
    setVisibleState(next);
  }, []);

  const dismiss = useCallback(() => {
    if (playingIdRef.current) setDismissedId(playingIdRef.current);
  }, []);

  const showDock = !!playing && !visible && dismissedId !== playing.id;

  const value = useMemo<NowPlayingContextValue>(
    () => ({ playing, showDock, start, stop, setVisible, dismiss }),
    [playing, showDock, start, stop, setVisible, dismiss],
  );

  return (
    <NowPlayingContext.Provider value={value}>
      {children}
      <NowPlayingDock playing={playing} showDock={showDock} dismiss={dismiss} />
    </NowPlayingContext.Provider>
  );
}

/**
 * The floating mini frame itself.
 *
 * Portalled to <body> and gated on a post-mount `mounted` flag for the same
 * reason components/ui/toast.tsx does it: `typeof document` is already true
 * during hydration, so portalling on the very first client render adds a
 * <body> child the server never emitted and React discards + regenerates the
 * whole tree to recover — a flash plus a window of dead clicks app-wide.
 * Deferring the portal one tick keeps SSR and the first client render
 * identical.
 */
function NowPlayingDock({
  playing,
  showDock,
  dismiss,
}: {
  playing: NowPlayingItem | null;
  showDock: boolean;
  dismiss: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const Icon = playing ? KIND_ICON[playing.kind] : Music2;

  return createPortal(
    <AnimatePresence>
      {showDock && playing && (
        <motion.div
          key={playing.id}
          initial={{ opacity: 0, y: 24, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.92 }}
          transition={{ type: "spring", duration: 0.35, bounce: 0 }}
          role="region"
          aria-label={`Đang xem: ${playing.title}`}
          /*
           * z-40: above ordinary page content (page-shell header sits at
           * z-20, the desktop sidebar at z-20) and above the cross-route
           * NavigationMiniDock precedent (also z-40, features/locations),
           * but below <Modal> (z-50) and the confirm dialogs built on it
           * (z-[60]) — opening any dialog must still visually cover this.
           * Desktop-only: below `lg` the app has a bottom tab bar and no
           * spare corner for a second floating element.
           */
          className="fixed bottom-6 right-6 z-40 hidden w-72 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_10px_30px_rgba(0,0,0,0.25)] lg:block"
        >
          <div className="flex items-center gap-3 p-3">
            {playing.thumbnailUrl ? (
              <img
                src={playing.thumbnailUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <span className="bg-accent-soft text-accent flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{playing.title}</p>
              <p className="text-muted-foreground truncate text-xs">{playing.providerLabel}</p>
            </div>
          </div>

          {/*
           * No play/pause control here: the only way this app could
           * "pause" the embed is to unmount its iframe, and remounting it
           * restarts the clip from 0:00 rather than resuming — that would
           * read as pause/resume but actually behave as stop/restart, which
           * is more misleading than not offering the control at all.
           */}
          <div className="flex border-t border-border">
            <button
              type="button"
              onClick={playing.onReturn}
              aria-label={`Quay lại xem đầy đủ ${playing.title}`}
              className={cn(
                "text-accent hover:bg-accent-soft flex-1 px-3 py-2 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              )}
            >
              Xem đầy đủ
            </button>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Đóng khung xem nhỏ"
              className={cn(
                "text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center px-3 py-2 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              )}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
