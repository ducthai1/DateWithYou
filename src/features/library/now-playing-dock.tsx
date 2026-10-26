"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChefHat,
  Maximize2,
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Video,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  EmbedPlayer,
  EMBED_ASPECT,
  SPOTIFY_BAR_HEIGHT,
} from "@/components/ui/embed-player";
import { cn } from "@/lib/utils";
import type { MediaListItem } from "./media-card";
import type { NowPlayingItem } from "./now-playing-context";
import { useFloatingWindow, type DragMode } from "./use-floating-window";
import { useYouTubePlayback, withJsApi } from "./use-youtube-playback";
import {
  COMMAND_TOLERANCE_SEC,
  DRIFT_TOLERANCE_SEC,
  targetPosition,
  type ListenTogether,
} from "./use-listen-together";
import { ListenTogetherControls } from "./listen-together-controls";
import { ListenNoticeOverlay } from "./listen-notice-overlay";
import { followTarget, noticeText, partnerAction, SEEK_NOTICE_SEC } from "@/lib/listen-notice";
import { usePlayerSlot, usePlayerSlotExpected } from "./player-slot";
import { usePlayerPauseTicket } from "./player-command";
import { useSlotRect } from "./use-slot-rect";
import { useScrollMirror } from "./use-scroll-mirror";
import { usePlayerLandscape } from "./use-player-landscape";
import {
  exitPlayerLandscape,
  landscapeBox,
  onFullscreenLost,
  registerPlayerLandscapeTarget,
} from "@/lib/player-landscape";

const KIND_ICON: Record<MediaListItem["kind"], typeof Music2> = {
  music: Music2,
  food_video: Video,
  recipe: ChefHat,
  game: Music2, // games have no url and never reach the dock; kept exhaustive
};

const MIN_W = 180;
/* Wider ceiling so the window can be pulled up to a comfortable size on a
   tablet or a desktop; on a phone it is still clamped to the viewport. */
const MAX_W = 900;
/** Inset around the frame, so the panel's own edge stays visible. */
const PAD = 6;
/** Fixed parts of the panel's height, so it can be computed from the width
 *  alone: 1px border each side, the title strip, and the toolbar row. */
const BORDER = 2;
const STRIP_H = 28;
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
/**
 * Height of the shared-listening strip.
 *
 * It gets a row of its own rather than a slot in the info row because the dock
 * opens at 224px on a phone and 320px on desktop, both under NARROW_W — so
 * anything sharing that row would have shown as a bare icon at every default
 * size, and an icon is not an explanation.
 */
const LISTEN_STRIP_H = 34;
const AUTONEXT_KEY = "vivu.nowplaying.autonext";

/** The video id out of a YouTube embed URL, for loading it into a live player. */
function youtubeVideoId(embedUrl: string | null): string | null {
  if (!embedUrl) return null;
  try {
    return new URL(embedUrl).pathname.match(/\/embed\/([\w-]+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

const CORNERS: Array<{
  mode: Exclude<DragMode, "move">;
  className: string;
  label: string;
}> = [
  {
    mode: "nw",
    className: "top-0 left-0 cursor-nwse-resize",
    label: "trên trái",
  },
  {
    mode: "ne",
    className: "top-0 right-0 cursor-nesw-resize",
    label: "trên phải",
  },
  {
    mode: "sw",
    className: "bottom-0 left-0 cursor-nesw-resize",
    label: "dưới trái",
  },
  {
    mode: "se",
    className: "right-0 bottom-0 cursor-nwse-resize",
    label: "dưới phải",
  },
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
  listen,
  queue,
  index,
  intent,
}: {
  item: NowPlayingItem | null;
  position: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  /** The shared session. The dock owns the frame, so it owns play/pause/seek. */
  listen: ListenTogether;
  /** The full local queue, for handing over when a session starts. */
  queue: readonly NowPlayingItem[];
  index: number;
  /** Why the current track is up: a press here, or the session moving. */
  intent: "press" | "follow";
}) {
  /*
   * The layer the panel is rendered into: one fixed, full-screen element on
   * <body> that never receives pointer events itself. Floating, the panel is
   * fixed inside it and the layer is inert. Docked, the layer scrolls in step
   * with the page (use-scroll-mirror) and the panel sits in it absolutely, so
   * a wheel over the frame scrolls the page and the frame rides along.
   */
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = document.createElement("div");
    el.setAttribute("data-player-layer", "");
    Object.assign(el.style, {
      position: "fixed",
      inset: "0",
      zIndex: "40",
      overflowX: "hidden",
      overflowY: "hidden",
      pointerEvents: "none",
      overscrollBehavior: "contain",
      scrollbarWidth: "none",
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(el);
    setLayer(el);
    return () => {
      el.remove();
      setLayer(null);
    };
  }, []);
  const mounted = layer !== null;
  const viewportH = useViewportHeight();
  const router = useRouter();

  /*
   * "Docked": a page has registered a box for the player (the watch page), so
   * this panel lays itself over that box and hides its own chrome — the page
   * draws the title, the playlist and the controls itself. The frame is the
   * very same element in both modes; only its geometry changes, which is the
   * whole point (see player-slot.ts). The mode switch animates; while docked,
   * the box is followed without a transition so scrolling does not lag.
   */
  const slotEl = usePlayerSlot();
  const slotRect = useSlotRect(slotEl);
  const docked = slotRect !== null;
  const spacer = useScrollMirror(layer, slotRect?.box ?? null, docked);
  // Phát was just pressed and the watch page is still on its way: stay out
  // of sight rather than flash in the corner and slide up (see player-slot).
  const hidden = usePlayerSlotExpected() && !docked;
  const mode = hidden ? "hidden" : docked ? "docked" : "floating";

  /*
   * Landscape mode (see @/lib/player-landscape): the same panel, the same
   * frame, laid over the whole screen — turned 90° when the screen is still
   * portrait. Nothing is re-mounted: a new iframe would start the video over.
   */
  const landscape = usePlayerLandscape();
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!landscape) return;
    const measure = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitPlayerLandscape();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      document.removeEventListener("keydown", onKey);
    };
  }, [landscape]);
  // Above the app's own bars: the layer sits at 40, under the header and the nav.
  useEffect(() => {
    if (layer) layer.style.zIndex = landscape ? "1000" : "40";
  }, [layer, landscape]);
  useEffect(() => {
    /*
     * Two kinds of fullscreen to look after. Ours, taken away by the system
     * (Android's back gesture, the app going to the background): leave the
     * mode. And YouTube's own button inside the frame: on Android the screen
     * can be locked to landscape for it too, so that button turns the phone
     * on its side and keeps it there, instead of following every tilt.
     */
    const onChange = () => {
      onFullscreenLost();
      const fs = document.fullscreenElement;
      const ours = fs?.tagName === "IFRAME" && !!layer?.contains(fs);
      const orientation = screen.orientation as ScreenOrientation & { lock?: (o: "landscape") => Promise<void> };
      if (ours) orientation?.lock?.("landscape").catch(() => {});
      else if (!fs) {
        try {
          orientation?.unlock?.();
        } catch {
          /* nothing locked */
        }
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [layer]);
  const [settling, setSettling] = useState(false);
  const lastMode = useRef(mode);
  useEffect(() => {
    const from = lastMode.current;
    if (from === mode) return;
    lastMode.current = mode;
    // Only a visible move animates; appearing from hidden lands in place.
    if (from === "hidden" || mode === "hidden") return;
    setSettling(true);
    const t = setTimeout(() => setSettling(false), 320);
    return () => clearTimeout(t);
  }, [mode]);

  /*
   * Play/pause talks to the frame directly, so it needs the frame. Reaching
   * for it through the media box keeps EmbedPlayer's shape unchanged — it is
   * used by the cards too, which have nothing to control.
   */
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const getFrame = useCallback(
    () => mediaRef.current?.querySelector("iframe") ?? null,
    [],
  );
  const controllable =
    item?.embed.provider === "youtube" && Boolean(item.embed.embedUrl);

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

  /*
   * The frame outlives a track.
   *
   * `frameKey` is what the iframe is built from, and it only changes when a
   * genuinely new frame is needed. An automatic advance keeps the frame and
   * swaps the video inside it — which is the whole point: a new iframe in a
   * background tab is a new autoplay decision, and Chrome does not grant one to
   * a tab nobody is looking at. The player already running holds that
   * permission, and has already completed its handshake, so it can be told to
   * load the next video with no timer and no new grant involved.
   */
  const [frameKey, setFrameKey] = useState<string | null>(null);
  /** Which track the player currently holds, frame reuse included. */
  const loadedTrack = useRef<string | null>(null);

  /*
   * What the person does INSIDE the player — tap-to-pause, a scrub, the
   * hardware pause on a phone — reaches the other side through here. Read via
   * a ref: this callback is held by the frame's listener for the life of the
   * track, and a captured `listen` would be the one from whenever the track
   * started.
   */
  const listenRef = useRef(listen);
  listenRef.current = listen;
  /*
   * Set while this device is behind the session it belongs to: it was away
   * (another app, a locked screen) and its player was paused or frozen by the
   * OS, not by the person. Until it has caught up, the first press of play is
   * a "take me back to where we are", not "everybody come to where I am" —
   * reporting it used to drag the other person back to this phone's stale
   * position.
   */
  const needsRejoin = useRef(false);
  const catchUpRef = useRef<(() => Promise<void>) | null>(null);
  /*
   * A frame that has just come up and been lined up with the session is still
   * moving into place for a moment, and what it says in that moment is not a
   * hand. Measured: reloading the page while the two were paused, the seek
   * that lined the new frame up STARTED it — YouTube plays a cued video when
   * told to seek — and that "playing" went out as this person pressing play,
   * so both phones started again on their own. Inside the window the frame is
   * held to what the session says instead of being reported.
   */
  const holdTo = useRef<{ until: number; isPlaying: boolean } | null>(null);
  const playbackRef = useRef<{ pause: () => void } | null>(null);
  const onFrameChange = useCallback(
    (c: { isPlaying: boolean; positionSec: number }) => {
      const hold = holdTo.current;
      if (hold && Date.now() < hold.until && listenRef.current.live) {
        if (c.isPlaying && !hold.isPlaying) playbackRef.current?.pause();
        return;
      }
      if (needsRejoin.current && c.isPlaying) {
        needsRejoin.current = false;
        void catchUpRef.current?.();
        return;
      }
      listenRef.current.report({
        isPlaying: c.isPlaying,
        positionSec: c.positionSec,
      });
    },
    [],
  );

  const playback = useYouTubePlayback(
    getFrame,
    controllable,
    frameKey ?? "",
    handleEnded,
    onFrameChange,
  );
  playbackRef.current = playback;

  /*
   * A handle for the browser suite to make THIS player fall behind on its own,
   * the way a phone on a slow network does — something no button can do,
   * because every button is a hand and a hand is reported. Development only.
   */
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !controllable) return;
    const w = window as unknown as { __vivuPlayer?: { seekQuietly: (sec: number) => void } };
    w.__vivuPlayer = { seekQuietly: (sec) => playback.seek(sec) };
    return () => {
      delete w.__vivuPlayer;
    };
  }, [controllable, playback]);

  useEffect(() => {
    if (!item) {
      loadedTrack.current = null;
      setFrameKey(null);
      return;
    }
    if (loadedTrack.current === item.id) return;

    const auto = endedTrack.current != null && endedTrack.current !== item.id;
    const videoId = controllable ? youtubeVideoId(item.embed.embedUrl) : null;
    if (auto && videoId && frameKey && playback.readyFor === frameKey) {
      playback.loadVideo(videoId);
      endedTrack.current = null;
      loadedTrack.current = item.id;
      return;
    }
    // Anything else — a hand-picked track, a different provider, the first
    // play — gets its own frame.
    loadedTrack.current = item.id;
    setFrameKey(item.id);
  }, [item, controllable, frameKey, playback]);

  /*
   * Built once per frame. Changing this string would reload the video from the
   * beginning, since it is also what the frame is keyed by.
   *
   * A frame raised for an automatic advance starts itself; one the person asked
   * for waits to be pressed.
   */
  const liveAtMount = useRef(false);
  /*
   * Only a session that is PLAYING starts the frame. A page reloaded while the
   * two were paused used to come up playing — and its "playing" was then
   * reported as a press, so both phones started again by themselves.
   */
  liveAtMount.current = listen.live && (listen.partnerState?.isPlaying ?? true);
  const intentRef = useRef(intent);
  intentRef.current = intent;
  /*
   * An invite that has not been answered holds the music.
   *
   * Pressing "Nghe cùng" on a card used to start playing here at once, so by
   * the time the other person accepted, this side was already well into the
   * song and they were dragged to wherever it had got to. Nothing plays while
   * the answer is outstanding; accepting is what starts both — see the accept
   * handler on the server, which re-times the state at that instant.
   */
  const waitingRef = useRef(listen.waiting);
  waitingRef.current = listen.waiting;
  const frameEmbed = useMemo(() => {
    if (!item?.embed.embedUrl || !controllable) return item?.embed;
    // Automatic advance, or a track adopted from the shared session: both are
    // frames nobody will press play on, so they must start themselves.
    const auto =
      (endedTrack.current != null && endedTrack.current !== frameKey) ||
      liveAtMount.current ||
      /*
       * A press must play. Pressing Phát only LOADED the player: the person
       * landed on the watch page with the poster and YouTube's own play
       * button, and had to press a second time — and in a shared session that
       * second press was the only thing that ever started the music, so the
       * two sides sat at different points from the very first track. The tap
       * on the card is the gesture the browser's autoplay rule wants, and it
       * is still the same document after the navigation, so it counts.
       */
      (intentRef.current === "press" && !waitingRef.current);
    return {
      ...item.embed,
      embedUrl: withJsApi(item.embed.embedUrl, window.location.origin, auto),
    };
    // Keyed on the frame alone — see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey, controllable]);

  /* Fallback for the advance that did need a new frame. */
  useEffect(() => {
    const ended = endedTrack.current;
    if (!ended || !playback.readyFor || playback.readyFor === ended) return;
    endedTrack.current = null;
    playback.play();
  }, [playback]);

  /*
   * And the same in the other direction: ask the frame to play as soon as it
   * answers. The `autoplay` flag in its URL is the fast path — it needs no
   * message and so works in a background tab — but a browser may ignore it,
   * and then a pressed track would sit silent. One `playVideo` per frame,
   * once, so pausing straight afterwards is not undone.
   */
  const startedFrame = useRef<string | null>(null);
  useEffect(() => {
    if (!controllable || !frameKey || playback.readyFor !== frameKey) return;
    if (startedFrame.current === frameKey) return;
    if (listen.waiting) return; // Held until the other person answers.
    startedFrame.current = frameKey;
    if (intentRef.current === "press") playback.play();
  }, [controllable, frameKey, playback, listen.waiting]);

  /*
   * Let the session read this frame's playhead for its periodic write.
   *
   * Assigned rather than passed down as a callback prop: the reader has to be
   * the CURRENT frame's, and the session's timer must not re-arm every time a
   * new track gives it a new function.
   */
  useEffect(() => {
    listen.positionReader.current = controllable
      ? () => ({
          positionSec: playback.getPosition(),
          isPlaying: playback.playing,
          index,
          // By id: `index` is into THIS device's queue, which need not be the session's.
          trackId: itemIdRef.current,
        })
      : null;
    return () => {
      listen.positionReader.current = null;
    };
  }, [listen.positionReader, controllable, playback, index]);

  /*
   * Apply what the other person just did.
   *
   * Play/pause goes through as-is; the playhead is only corrected past
   * DRIFT_TOLERANCE_SEC, because a seek is audible and being half a second
   * apart is not. Waits for `readyFor` — a frame that has not finished its
   * handshake drops every command silently, which would look like the sync
   * simply not working.
   */
  const appliedPartner = useRef<string | null>(null);
  /** The frame that has been lined up with the session since it came ready. */
  const alignedFrame = useRef<string | null>(null);
  useEffect(() => {
    const ps = listen.partnerState;
    if (!ps || !listen.live || !controllable) return;
    if (!frameKey || playback.readyFor !== frameKey) return;
    /*
     * Only once the frame on screen IS the track the message is about.
     *
     * React runs a child's effects before its parent's, so on a track change
     * this ran before the provider had swapped the queue: the message was
     * applied to the OUTGOING frame and its stamp spent, and the new frame
     * was never told to play. Returning here without stamping lets the same
     * message be applied when the right frame is ready.
     */
    if (ps.queue[ps.index]?.id !== item?.id) return;
    // The same state message must not be re-applied on every render — unless
    // a new frame has come up for this track since, which has to be lined up.
    const stamp = `${ps.id}:${ps.updatedBy}:${ps.receivedAt}`;
    const freshFrame = alignedFrame.current !== frameKey;
    if (appliedPartner.current === stamp && !freshFrame) return;
    appliedPartner.current = stamp;
    alignedFrame.current = frameKey;

    /*
     * Two tolerances, because two different things arrive here.
     *
     * A command — the other person pressed pause, resumed, or moved to another
     * track — is a moment when the two players are being interrupted anyway,
     * so lining them up to within a fraction of a second costs nothing
     * audible. With one loose tolerance every pause left the follower a
     * second behind (the message's own travel time) and never corrected it,
     * and a track change left them the frame's load time apart: the two
     * sides were audibly out of step for the whole song. The periodic refresh
     * of an unchanged state keeps the loose tolerance — there a seek would be
     * a jump out of nowhere in the middle of listening.
     *
     * A frame that has just come up is lined up tightly too, whatever the
     * message: it started from zero when the song was already under way.
     */
    /*
     * A new epoch is a command too — that is how a SEEK is recognised, since it
     * changes neither playing nor the track. Judged on substance alone, a seek
     * got the loose drift tolerance and anything under 2.5 s was dropped.
     */
    const epoch = ps.epoch ?? 0;
    const l = listenRef.current;
    /*
     * Measured against what THIS DEVICE knows — the other person's messages it
     * followed AND the answers to its own presses. Measured against the other
     * person's messages alone, the first routine write after any press made
     * here carried an epoch never seen in them, read as "they seeked", and
     * pulled this player back to them: a jolt of about a second after every
     * pause, resume or seek made here (measured with two browsers).
     */
    const known = l.known.current?.id === ps.id ? l.known.current : null;
    // Older than what this device already knows — its own press landed after it was sent.
    if (known && epoch < known.epoch && !freshFrame) return;
    const command =
      !known || known.isPlaying !== ps.isPlaying || known.index !== ps.index || known.epoch !== epoch;
    /*
     * A seek and nothing else, to within SEEK_NOTICE_SEC of where this player
     * already is, is the same place as far as anyone can hear — and seeking to
     * it is a jolt for nothing. The other person pausing, resuming or changing
     * track is still lined up tightly.
     */
    const onlySeek = command && known !== null && known.isPlaying === ps.isPlaying && known.index === ps.index;
    /*
     * The other phone writing down where it is, while a press made HERE is
     * still on its way: it describes the moment before that press. Followed,
     * it undid the press — measured: the guest paused, the host's routine
     * write ("playing") arrived first, the guest's frame was started again and
     * played on alone while the session stood paused. The next write after the
     * press lands carries the new epoch.
     */
    if (!command && !freshFrame && l.commandInFlight()) return;
    const want = targetPosition(ps);
    const mine = playback.getPosition();
    /*
     * Put into words BEFORE moving, while "where this player was" still means
     * something — and only for what the other person did (`origin`), not for a
     * reload or this device's own answer coming back.
     */
    const action =
      ps.origin === "stream"
        ? partnerAction(
            known,
            { isPlaying: ps.isPlaying, index: ps.index, epoch, positionSec: want, trackTitle: ps.queue[ps.index]?.title ?? "" },
            mine,
          )
        : null;
    /*
     * A command — or a frame that just came up — is followed both ways. A
     * refresh only ever pulls this player FORWARD: followed backwards, the
     * phone that buffered dragged the other one back to it every 15 s.
     */
    const target = followTarget(mine, want, {
      command: command || freshFrame,
      commandTolerance: onlySeek && !freshFrame ? SEEK_NOTICE_SEC : COMMAND_TOLERANCE_SEC,
      driftTolerance: DRIFT_TOLERANCE_SEC,
    });
    if (target !== null) playback.seek(target);
    /*
     * A pause is sent whatever `playing` says. A frame that is BUFFERING — as
     * it is right after a seek — reads as not playing, so a pause arriving then
     * was skipped as already done, and the frame played on once it had
     * buffered while the session stood paused. Pausing a paused frame is a
     * no-op.
     */
    if (!ps.isPlaying) playback.pause();
    else if (!playback.playing) playback.play();
    /*
     * Narrow on purpose: only a paused session, only after a seek, only for a
     * moment. Held for 3 s whatever the state, it swallowed a real pause made
     * right after the video came up.
     */
    holdTo.current =
      freshFrame && !ps.isPlaying && target !== null ? { until: Date.now() + 2000, isPlaying: false } : null;
    if (action) l.announce(noticeText(action, l.partnerName));
    else if (target !== null && !command && !freshFrame)
      // This phone fell behind (network, buffering) — nobody pressed anything.
      l.announce(`Bắt kịp ${l.partnerName}: máy bạn chậm ${Math.round(target - mine)} giây`);
    // Followed: from now on this player's refresh may speak for this epoch.
    l.markApplied(epoch);
    l.know({ id: ps.id, isPlaying: ps.isPlaying, index: ps.index, epoch });
    needsRejoin.current = false;
  }, [
    listen.partnerState,
    listen.live,
    controllable,
    frameKey,
    playback,
    item?.id,
  ]);

  /*
   * Catch up with the session after being away.
   *
   * Asks the server where the session is NOW rather than trusting the last
   * message: the stream was dead while the phone was elsewhere, and the other
   * person kept listening. Lines the frame up and says nothing — this device is
   * the one that is behind, so there is nothing for the other side to hear.
   * A different track is left to the provider, which follows the queue.
   */
  const catchUp = useCallback(async () => {
    const l = listenRef.current;
    if (!l.live || !controllable) return;
    const asked = Date.now();
    const s = await l.fetchCurrent().catch(() => null);
    if (!s || s.status !== "live" || s.queue[s.index]?.id !== itemIdRef.current) return;
    const want = targetPosition({ ...s, receivedAt: asked });
    if (Math.abs(playback.getPosition() - want) > COMMAND_TOLERANCE_SEC) playback.seek(want);
    if (s.isPlaying && !playback.playing) playback.play();
    if (!s.isPlaying) playback.pause();
    l.markApplied(s.epoch);
    l.know(s);
    /*
     * iOS may refuse to start a frame nobody has touched since the page came
     * back. Whether it did is known a moment later; if it did not, the next
     * press of play (on the frame or here) is still a catch-up.
     */
    needsRejoin.current = s.isPlaying;
    setTimeout(() => {
      // Read through a ref: `playback.playing` here would be this render's value.
      if (playingNow.current) needsRejoin.current = false;
    }, 3000);
  }, [controllable, playback]);
  catchUpRef.current = catchUp;
  const playingNow = useRef(false);
  playingNow.current = playback.playing;

  /*
   * Leaving the app and coming back.
   *
   * Hidden: nothing this player does is reported (the session hook stays
   * silent while the page is hidden) — the OS pausing a backgrounded video
   * used to reach the other phone as a pause and stop them too. Back: a short
   * quiet spell swallows the frame's own catching-up messages, then the player
   * is lined up with where the session got to.
   */
  useEffect(() => {
    if (!controllable) return;
    const onVisibility = () => {
      const l = listenRef.current;
      if (!l.live) return;
      if (document.visibilityState === "hidden") {
        needsRejoin.current = true;
        return;
      }
      l.quiet(2500);
      void catchUpRef.current?.();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onVisibility);
    };
  }, [controllable]);

  /** Play/pause, and tell the other side — one action, both effects. */
  const togglePlayback = useCallback(() => {
    // Back from elsewhere and behind: this press means "rejoin", not "come here".
    if (needsRejoin.current && !playback.playing && listen.live) {
      needsRejoin.current = false;
      playback.play();
      void catchUp();
      return;
    }
    const nowPlaying = !playback.playing;
    playback.toggle();
    listen.report({
      isPlaying: nowPlaying,
      positionSec: playback.getPosition(),
    });
  }, [playback, listen, catchUp]);

  /*
   * Another screen has asked for silence — the TikTok feed, which plays sound
   * of its own. Routed through togglePlayback rather than the frame directly,
   * so a shared session hears about the pause like any other.
   */
  const pauseTicket = usePlayerPauseTicket();
  const handledPause = useRef(pauseTicket);
  useEffect(() => {
    if (handledPause.current === pauseTicket) return;
    handledPause.current = pauseTicket;
    if (controllable && playback.playing) togglePlayback();
  }, [pauseTicket, controllable, playback.playing, togglePlayback]);

  /** Invite the partner to whatever is playing, from where it is. */
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
  const capH = Math.max(140, Math.round((viewportH || 640) * 0.62));

  /** The frame's height for a width — the one rule both the layout below and a
   *  corner pull's bottom-edge anchor read from. */
  const mediaHeightFor = (w: number) => {
    const h = aspect ? Math.round((w - PAD * 2) / aspect) : SPOTIFY_BAR_HEIGHT;
    return aspect && h > capH ? capH : h;
  };

  /*
   * Only where a session could actually work: YouTube is the one provider whose
   * frame answers postMessage, so it is the only one where two devices can be
   * held at the same second. Offering it elsewhere would be a promise the app
   * cannot keep.
   */
  const showListenStrip = controllable && listen.enabled;

  const { boxRef, box, moveProps, cornerProps } = useFloatingWindow({
    storageKey: "vivu.nowplaying.window",
    minWidth: MIN_W,
    maxWidth: MAX_W,
    // The strip is counted, or a bottom-corner drag would jump by its height:
    // the ref this closes over is refreshed every render, so the sum is always
    // the one currently on screen.
    heightFor: (w) =>
      BORDER +
      STRIP_H +
      mediaHeightFor(w) +
      barHeightFor(w) +
      (showListenStrip ? LISTEN_STRIP_H : 0) +
      PAD,
  });

  // The panel is what goes fullscreen in landscape mode; nothing playing, nothing to turn.
  const hasItem = Boolean(item);
  useEffect(() => {
    registerPlayerLandscapeTarget(hasItem ? boxRef.current : null);
    if (!hasItem) exitPlayerLandscape();
    return () => registerPlayerLandscapeTarget(null);
  }, [hasItem, boxRef]);

  if (!mounted || !layer || !box) return null;

  const Icon = item ? KIND_ICON[item.kind] : Music2;
  const embeddable = Boolean(item?.embed.embedUrl);
  /** The box landscape mode fills; null until the viewport has been measured. */
  const lbox = landscape && viewport.w > 0 ? landscapeBox(viewport.w, viewport.h) : null;
  /** Laid into a box chosen elsewhere — the page's slot, or the whole screen — so no window chrome. */
  const framed = docked || landscape;

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
  const mediaW =
    aspect && mediaH === capH ? Math.round(capH * aspect) : box.w - PAD * 2;

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
        <span className="bg-accent-soft text-accent-ink flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item?.title}</p>
        <p className="text-muted-foreground truncate text-xs">
          {total > 1
            ? `${item?.providerLabel} · ${position}/${total}`
            : item?.providerLabel}
        </p>
      </div>
      {/* Beside the track name, centred against its two lines — not up on the
          title strip, which exists to drag the window and nothing else. */}
      {controllable && (
        <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
          <span className="text-muted-foreground text-[10px] leading-none font-medium">
            Tự phát
          </span>
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
      <button
        type="button"
        onClick={onPrev}
        disabled={!hasPrev}
        aria-label="Bài trước"
        className={skipButton}
      >
        <SkipBack className="h-4 w-4" />
      </button>
      {/* Only where the frame can actually be driven — a dead play button is
          worse than no play button. */}
      {controllable && (
        <button
          type="button"
          onClick={togglePlayback}
          aria-label={playback.playing ? "Tạm dừng" : "Phát"}
          aria-pressed={playback.playing}
          className={cn(
            skipButton,
            "bg-accent-soft text-accent-ink hover:bg-accent hover:text-white",
          )}
        >
          {playback.playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={!hasNext}
        aria-label="Bài sau"
        className={skipButton}
      >
        <SkipForward className="h-4 w-4" />
      </button>
    </>
  );

  /*
   * One row, its own width, words at every size.
   *
   * Idle it is the invitation; waiting it says who is being waited on; live it
   * says who you are listening with and how to stop. All three carry the
   * partner's name, because "nghe cùng" on its own does not say with whom.
   */
  const listenStrip = showListenStrip ? (
    <div
      className="pointer-events-none relative z-10 flex items-center justify-center pt-1"
      style={{ height: LISTEN_STRIP_H }}
    >
      <ListenTogetherControls
        listen={listen}
        queue={queue}
        index={index}
        getState={() => ({
          positionSec: controllable ? playback.getPosition() : 0,
          isPlaying: controllable ? playback.playing : false,
        })}
      />
    </div>
  ) : null;

  return createPortal(
    <>
      {/* Gives the layer the page's scroll height while docked; see use-scroll-mirror. */}
      <div
        aria-hidden="true"
        style={{ height: spacer, pointerEvents: "none" }}
      />
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
            style={
              landscape && lbox
                ? {
                    // The whole screen, turned when the screen is portrait. Framer
                    // composes `x` before `rotate`, i.e. rotate about the top-left
                    // corner, then slide right by the screen's width.
                    position: "fixed" as const,
                    left: 0,
                    top: 0,
                    width: lbox.width,
                    height: lbox.height,
                    x: lbox.shiftX,
                    rotate: lbox.rotated ? 90 : 0,
                    originX: 0,
                    originY: 0,
                    touchAction: "none",
                  }
                : {
                    ...(slotRect
                      ? {
                          // In the layer's content space, which scrolls with the page.
                          position: "absolute" as const,
                          left: slotRect.left,
                          top: slotRect.boxTop + slotRect.top,
                          width: slotRect.width,
                          height: slotRect.height,
                        }
                      : box.x == null
                        ? { width: box.w }
                        : { width: box.w, left: box.x, top: box.y ?? 0 }),
                    x: 0,
                    rotate: 0,
                    ...(hidden ? { visibility: "hidden" as const } : {}),
                  }
            }
            className={cn(
              /*
              No `overflow-hidden` on the floating panel on purpose. With it,
              `rounded-2xl` clips the children's hit area to the rounded shape,
              and the few pixels nearest each corner stop responding — the
              corner people aim at to grab or resize the panel goes dead. The
              frame inside has its own rounding, so nothing needs clipping at
              this level. Docked, there are no grips and the frame must be cut
              to the slot's corners, so it is clipped there.
            */
              // The layer swallows nothing; the panel is the one thing in it that does.
              "pointer-events-auto fixed",
              landscape
                ? "overflow-hidden bg-black"
                : docked
                  ? "overflow-hidden rounded-2xl bg-black"
                  : "border-border bg-card rounded-2xl border shadow-[0_10px_30px_rgba(0,0,0,0.25)]",
              // Parked above the bottom nav until the first drag moves it.
              !docked &&
                !landscape &&
                box.x == null &&
                "right-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:right-6 sm:bottom-6",
              settling &&
                !landscape &&
                "transition-[left,top,width,height] duration-300 ease-out",
            )}
          >
            {/*
            Corner grips come first so the toolbar below paints over them, and
            they are deliberately square and unclipped: a `rounded-*` here
            clips a grip's own hit area, and the outermost corner — the one
            people aim at — falls through to the drag surface and moves the
            panel instead of sizing it.
          */}
            {!framed &&
              CORNERS.map((c) => (
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
            {!framed && (
              <div
                {...moveProps}
                style={{ touchAction: "none" }}
                /* Nothing but the drag surface. Controls belong beside the track
               name below, where the eye already is. */
                className="relative flex h-7 cursor-grab items-center justify-center rounded-t-2xl active:cursor-grabbing"
              >
                <span
                  className="bg-muted-foreground/30 h-1 w-10 rounded-full"
                  aria-hidden="true"
                />
                {/* Mirror of the X: open the full watch page — video, title,
                playlist — with this same frame carrying on uninterrupted. */}
                {embeddable && (
                  <button
                    type="button"
                    onClick={() => {
                      // Already there (the address is rewritten as tracks change,
                      // so it can name this very track) — a push would be a no-op
                      // and the button would look broken.
                      const to = `/library/phat/${item.id}`;
                      if (window.location.pathname === to) router.refresh();
                      else router.push(to);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    aria-label="Mở trang phát"
                    title="Mở trang phát"
                    className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-0 left-6 z-20 flex h-7 w-7 items-center justify-center rounded-full transition-colors"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {/* The X, where every window keeps it: top-right. It used to sit
                at the end of the transport row, where it read as one more
                playback button and took a moment to find. Left of the corner
                grip (24px) so resizing from that corner still works, and its
                pointerdown is stopped so pressing it does not start a drag. */}
                <button
                  type="button"
                  onClick={onClose}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label="Đóng trình phát"
                  className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-0 right-6 z-20 flex h-7 w-7 items-center justify-center rounded-full transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div
              {...(framed ? {} : moveProps)}
              style={
                framed
                  ? undefined
                  : {
                      paddingLeft: PAD,
                      paddingRight: PAD,
                      paddingBottom: PAD,
                      touchAction: "none",
                    }
              }
              className={
                framed ? "h-full" : "cursor-grab active:cursor-grabbing"
              }
            >
              {embeddable ? (
                <div
                  ref={mediaRef}
                  className={cn(
                    "bg-muted relative mx-auto overflow-hidden",
                    framed ? cn("h-full w-full", !landscape && "rounded-2xl") : "rounded-xl",
                  )}
                  style={framed ? undefined : { width: mediaW, height: mediaH }}
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
                    key={frameKey ?? item.id}
                    data={frameEmbed ?? item.embed}
                    fill
                  />
                  {controllable && <ListenNoticeOverlay listen={listen} />}
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
              {!framed && (
                <div
                  className="pointer-events-none relative z-10 flex items-center pt-2"
                  style={{ height: barH }}
                >
                  {narrow ? (
                    <div className="flex w-full min-w-0 flex-col gap-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {info}
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        {controls}
                      </div>
                    </div>
                  ) : (
                    <div className="flex w-full min-w-0 items-center gap-1.5">
                      {info}
                      {controls}
                    </div>
                  )}
                </div>
              )}

              {!framed && listenStrip}
            </div>

            {/*
              The way out, inside the turned box so it sits at the picture's own
              top-left whichever way the box is turned. Top-left because YouTube
              keeps its controls along the bottom and its share/more buttons at
              the top-right. A 44px tap area around a 36px disc.
            */}
            {landscape && (
              <button
                type="button"
                onClick={() => exitPlayerLandscape()}
                aria-label="Thoát xoay ngang"
                title="Thoát xoay ngang"
                className="absolute top-2 left-2 z-30 flex h-11 w-11 items-center justify-center"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white">
                  <X className="h-5 w-5" />
                </span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    layer,
  );
}
