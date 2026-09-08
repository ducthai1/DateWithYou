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
import type { EmbedData } from "@/components/ui/embed-player";
import type { MediaListItem } from "./media-card";
import { NowPlayingDock } from "./now-playing-dock";
import { useListenTogether, type ListenTogether } from "./use-listen-together";
import { ListenInviteModal } from "./listen-invite-modal";
import { useToast } from "@/components/ui/toast";
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
/**
 * `intent` is why this track is on screen: because somebody here pressed
 * something ("press"), or because the shared session moved ("follow"). The
 * dock reads it to decide whether the frame it is about to raise should start
 * itself — a press must play, a followed state is applied afterwards anyway.
 */
type QueueState = {
  queue: NowPlayingItem[];
  index: number;
  intent: "press" | "follow";
  /**
   * When somebody last pressed something HERE, by this device's clock.
   *
   * Only ever compared with `receivedAt` on a shared state — also this
   * device's clock — so the two phones' disagreeing clocks never enter into
   * it. It exists to order the two sources that both claim to say what should
   * be playing: the session, and the person in front of this screen.
   */
  pressedAt: number;
};

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

const EMPTY: QueueState = {
  queue: [],
  index: 0,
  intent: "follow",
  pressedAt: 0,
};

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
  const toast = useToast();
  // The rendered state, readable from callbacks without re-creating them.
  const stateRef = useRef(state);
  stateRef.current = state;
  /*
   * A session this device has deliberately walked away from.
   *
   * Ending it is not enough on its own: the stream is a poll, so a state
   * written before the person chose something else can still arrive after
   * they did — and once it has been applied, their choice is gone. Remembered
   * by id, so every later message about the SAME session is ignored while a
   * new invite (a new id, since inviting replaces the document) still works.
   */
  const dismissed = useRef<string | null>(null);
  const leaveSession = useCallback(
    (sessionId: string | null) => {
      if (sessionId) dismissed.current = sessionId;
      void listen.end();
      toast("Đã dừng nghe cùng — bạn vừa mở một danh sách khác", "info");
    },
    [listen, toast],
  );

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
      setState((s) => ({
        ...s,
        index: at,
        intent: "press",
        pressedAt: Date.now(),
      }));
      // The other side hears about a skip the same way as a pressed button.
      listen.report({ index: at, positionSec: 0, isPlaying: true });
    },
    [state.index, state.queue.length, listen],
  );
  const next = useCallback(
    () => jumpTo(state.index + 1),
    [jumpTo, state.index],
  );
  const prev = useCallback(
    () => jumpTo(state.index - 1),
    [jumpTo, state.index],
  );

  /*
   * A card's Phát, with a shared session in mind.
   *
   * Alone, it simply becomes the queue. In a live session it used to do the
   * same — and only here: this side now played from a list the other side had
   * never seen, while the periodic report kept pushing this side's index into
   * a session whose queue was still the old one, so the other person was
   * dragged to the wrong track of the wrong list. Now a track that is in the
   * shared queue is a skip, told to both sides like any other; one that is not
   * ends the session first, said out loud, and then plays here alone.
   */
  const start = useCallback(
    (queue: NowPlayingItem[], at: number) => {
      const wanted = queue[at];
      if (wanted && (listen.live || listen.waiting)) {
        const shared = stateRef.current.queue.findIndex(
          (q) => q.id === wanted.id,
        );
        if (shared >= 0 && listen.live) {
          jumpTo(shared);
          return;
        }
        leaveSession(listen.partnerState?.id ?? null);
      }
      setState({
        queue,
        index: Math.max(0, Math.min(at, queue.length - 1)),
        intent: "press",
        pressedAt: Date.now(),
      });
    },
    [listen, jumpTo, leaveSession],
  );

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
    if (ps.id === dismissed.current) return;
    const stamp = `${ps.id}:${ps.index}:${ps.queue.map((t) => t.id).join(",")}`;
    if (appliedState.current === stamp) return;

    /*
     * Which side was chosen more recently — the session, or the person here?
     *
     * Compared on when each was CHOSEN, not on when this device heard about
     * it. `receivedAt - stateAgeMs` is when somebody last wrote the session
     * state, in this device's own clock (an age plus a local arrival time, so
     * the two phones' disagreeing clocks never come into it); `pressedAt` is
     * when somebody pressed something here. Arrival order is the wrong test
     * and was measurably a coin flip: on a fresh load the session is seeded
     * from the server at the same moment the page's URL is adopted, and
     * whichever answered last won — so opening a link while listening
     * together sometimes bounced back to the shared track and sometimes did
     * not. Accepting an invite still wins, because the accept re-times the
     * state at that instant, which is later than any earlier press here.
     */
    const writtenAt = ps.receivedAt - ps.stateAgeMs;
    const local = stateRef.current;
    if (writtenAt < local.pressedAt) {
      appliedState.current = stamp;
      const playingId = local.queue[local.index]?.id;
      const stillOnTheList =
        playingId != null && ps.queue.some((t) => t.id === playingId);
      // They have moved to something the session does not contain, so they
      // have left it. Silence about it would leave both docks lying.
      if (!stillOnTheList) leaveSession(ps.id);
      return;
    }

    appliedState.current = stamp;
    setState((s) => {
      if (sameQueue(s.queue, ps.queue)) {
        return s.index === ps.index
          ? s
          : { ...s, index: ps.index, intent: "follow" };
      }
      return {
        queue: ps.queue.map(fromListenTrack),
        index: ps.index,
        intent: "follow",
        pressedAt: s.pressedAt,
      };
    });
  }, [listen.partnerState, listen.live, listen.waiting, leaveSession]);

  /** A card was deleted. Close if it was the one playing, otherwise just drop
   *  it from the queue and keep the cursor on the same track. */
  const stop = useCallback((id: string) => {
    setState((s) => {
      const at = s.queue.findIndex((q) => q.id === id);
      if (at < 0) return s;
      if (at === s.index) return EMPTY;
      return {
        ...s,
        queue: s.queue.filter((q) => q.id !== id),
        index: at < s.index ? s.index - 1 : s.index,
      };
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
        intent={state.intent}
      />
    </NowPlayingContext.Provider>
  );
}
