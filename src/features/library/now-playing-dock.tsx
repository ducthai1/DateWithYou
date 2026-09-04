"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChefHat, Music2, Video, X } from "lucide-react";
import { EmbedPlayer, type EmbedData } from "@/components/ui/embed-player";
import type { MediaListItem } from "./media-card";

/**
 * The thing that is playing, and the frame it plays in.
 *
 * It used to be a label: the iframe lived inside the media card, and this only
 * showed a "still playing" chip once the card scrolled away. That meant leaving
 * the library killed the music — React unmounts the page, the iframe goes with
 * it, and an iframe cannot be moved to another parent without reloading from
 * zero. There was no fix available from inside the card.
 *
 * So the player lives here, above the router, and survives every navigation
 * inside the app. The card hands over what to play and shows that it is
 * playing; this owns the only iframe.
 *
 * Nothing here observes real playback. These embeds are cross-origin YouTube /
 * Spotify / TikTok frames with no postMessage bridge, so "playing" means "this
 * is the frame that is mounted", which is the honest claim.
 */

export type NowPlayingItem = {
  id: string;
  kind: MediaListItem["kind"];
  title: string;
  thumbnailUrl: string | null;
  providerLabel: string;
  /** Everything the frame needs — the dock is the only place it is mounted. */
  embed: EmbedData;
};

type NowPlayingContextValue = {
  playing: NowPlayingItem | null;
  start: (item: NowPlayingItem) => void;
  stop: (id: string) => void;
};

const NowPlayingContext = createContext<NowPlayingContextValue>({
  playing: null,
  start: () => {},
  stop: () => {},
});

export function useNowPlaying() {
  return useContext(NowPlayingContext);
}

const KIND_ICON: Record<MediaListItem["kind"], typeof Music2> = {
  music: Music2,
  food_video: Video,
  recipe: ChefHat,
  game: Music2, // games have no url and never reach the dock; kept exhaustive
};

export function NowPlayingProvider({ children }: { children: ReactNode }) {
  const [playing, setPlaying] = useState<NowPlayingItem | null>(null);

  const start = useCallback((item: NowPlayingItem) => setPlaying(item), []);
  const stop = useCallback((id: string) => {
    setPlaying((cur) => (cur && cur.id !== id ? cur : null));
  }, []);

  const value = useMemo<NowPlayingContextValue>(
    () => ({ playing, start, stop }),
    [playing, start, stop],
  );

  return (
    <NowPlayingContext.Provider value={value}>
      {children}
      <NowPlayingDock playing={playing} onClose={() => setPlaying(null)} />
    </NowPlayingContext.Provider>
  );
}

/** The floating player. Portalled to the body so no page's stacking traps it. */
function NowPlayingDock({
  playing,
  onClose,
}: {
  playing: NowPlayingItem | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const Icon = playing ? KIND_ICON[playing.kind] : Music2;

  return createPortal(
    <AnimatePresence>
      {playing && (
        <motion.div
          key={playing.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
          role="region"
          aria-label={`Đang phát: ${playing.title}`}
          /*
           * On a phone too. This was `hidden lg:block`, so the one screen where
           * a floating player earns its place — the one you keep in your hand
           * while doing something else — never had one. It sits above the
           * bottom nav rather than over it.
           */
          className="border-border bg-card fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 overflow-hidden rounded-2xl border shadow-[0_10px_30px_rgba(0,0,0,0.25)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-80"
        >
          <div className="bg-muted">
            <EmbedPlayer data={playing.embed} />
          </div>
          <div className="flex items-center gap-3 p-3">
            <span className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{playing.title}</p>
              <p className="text-muted-foreground truncate text-xs">
                {playing.providerLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng trình phát"
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
