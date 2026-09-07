"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Play/pause for the embedded YouTube frame, over its widget postMessage
 * protocol — the same channel the official IFrame API uses, without pulling in
 * their script.
 *
 * Only YouTube. Spotify's embed has an undocumented equivalent and TikTok and
 * Instagram have none, so the button hides for those rather than sitting there
 * doing nothing.
 *
 * The frame must be loaded with `enablejsapi=1` or it ignores every message.
 */

const YT_ORIGIN = "https://www.youtube.com";

/** Player states the widget reports. */
const ENDED = 0;
const PLAYING = 1;

/**
 * Adds the flags the protocol needs, keeping whatever the stored URL had.
 *
 * `autostart` asks the player to begin on its own, and it is what makes the
 * queue keep moving while the tab is in the background. Telling the next frame
 * to play means a message, and a message means the handshake has completed —
 * which runs on a timer, and a hidden tab has its timers cut to one a second
 * and then one a minute. The track would sit loaded and silent until the tab
 * came back, which is exactly when the queued play arrived. Letting the frame
 * start itself needs no message at all.
 */
export function withJsApi(embedUrl: string, pageOrigin: string, autostart = false): string {
  try {
    const u = new URL(embedUrl);
    u.searchParams.set("enablejsapi", "1");
    // YouTube wants to know who is talking to it; without this it warns.
    if (pageOrigin) u.searchParams.set("origin", pageOrigin);
    if (autostart) {
      u.searchParams.set("autoplay", "1");
      // Phones otherwise take a video full-screen the moment it starts.
      u.searchParams.set("playsinline", "1");
    }
    return u.toString();
  } catch {
    return embedUrl;
  }
}

/** Something the person did inside the player, not through the app's buttons. */
export type FrameChange = { isPlaying: boolean; positionSec: number; reason: "state" | "seek" };

export function useYouTubePlayback(
  getFrame: () => HTMLIFrameElement | null,
  enabled: boolean,
  /**
   * Identifies the *frame*, not the track. A frame outlives a track now: the
   * next video is loaded into the running player rather than a new iframe.
   */
  frameKey: string,
  /** Fired when the video runs out — what "play the next one" hangs off. */
  onEnded?: () => void,
  /** Fired for a pause, resume or scrub done INSIDE the player — not by us. */
  onFrameChange?: (change: FrameChange) => void,
) {
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
  const frameChangeRef = useRef(onFrameChange);
  frameChangeRef.current = onFrameChange;
  /*
   * The last command THIS hook sent, with when. A state message that matches
   * it within a moment is our own doing echoed back, not the person tapping
   * the video — and only the person's taps are worth telling the other side.
   */
  const lastCommand = useRef<{ playing: boolean; at: number } | null>(null);
  const lastReportedState = useRef<boolean | null>(null);
  const [playing, setPlaying] = useState(false);
  /**
   * Which frame has actually answered — not a bare boolean.
   *
   * "Ready" lags a change by a render, so a caller waiting to act saw the
   * previous frame's readiness and fired at one being torn down. Naming what it
   * is ready for makes that impossible to confuse.
   */
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const playingRef = useRef(false);
  playingRef.current = playing;
  /*
   * The playhead, in seconds, kept in a ref rather than state.
   *
   * The frame already volunteers this several times a second in its
   * `infoDelivery` messages, so nothing has to be asked for — but rendering on
   * every one of them would re-render the whole dock a few times a second for
   * a number nothing on screen shows. A shared session reads it on demand.
   */
  const positionRef = useRef(0);
  const readyRef = useRef(false);
  readyRef.current = readyFor === frameKey;

  useEffect(() => {
    setPlaying(false);
    setReadyFor(null);
    positionRef.current = 0;
    lastCommand.current = null;
    lastReportedState.current = null;
  }, [frameKey]);

  useEffect(() => {
    if (!enabled) return;
    const frame = getFrame();
    const win = frame?.contentWindow;
    if (!win) return;

    const post = (msg: object) => win.postMessage(JSON.stringify(msg), YT_ORIGIN);

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== YT_ORIGIN || e.source !== win) return;
      let data: { event?: string; info?: unknown };
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : (e.data as typeof data);
      } catch {
        return;
      }
      if (!data?.event) return;
      setReadyFor(frameKey);
      /*
       * State arrives two ways: `onStateChange` carries the number directly,
       * while the periodic `infoDelivery` wraps it in an info object.
       */
      const info = data.info;
      const t = (info as { currentTime?: number })?.currentTime;
      if (typeof t === "number" && Number.isFinite(t)) {
        /*
         * A scrub inside the player shows up as the playhead jumping by far
         * more than the time between two readings. Readings arrive a few
         * times a second while playing, so anything beyond a couple of
         * seconds was a hand, not the clock — and one the other device needs
         * to follow. Our own seek() pre-writes positionRef, so it is not seen
         * as a jump here.
         */
        const prev = positionRef.current;
        positionRef.current = t;
        if (prev > 0 && Math.abs(t - prev) > 2.5) {
          frameChangeRef.current?.({ isPlaying: playingRef.current, positionSec: t, reason: "seek" });
        }
      }
      const state =
        typeof info === "number"
          ? info
          : typeof (info as { playerState?: number })?.playerState === "number"
            ? (info as { playerState: number }).playerState
            : null;
      if (state != null) {
        const nowPlaying = state === PLAYING;
        setPlaying(nowPlaying);
        if (state === ENDED) endedRef.current?.();
        /*
         * Pausing or resuming by tapping the video itself was invisible to
         * the shared session: only the dock's own button reported anything.
         * Every change of playing state lands here, ours included — so drop
         * the ones that merely confirm a command we just sent, and pass on
         * the rest, which can only have come from a hand on the player.
         */
        const PAUSED = 2;
        if ((state === PLAYING || state === PAUSED) && lastReportedState.current !== nowPlaying) {
          lastReportedState.current = nowPlaying;
          const own = lastCommand.current;
          const echo = own && own.playing === nowPlaying && Date.now() - own.at < 1500;
          if (!echo) {
            frameChangeRef.current?.({ isPlaying: nowPlaying, positionSec: positionRef.current, reason: "state" });
          }
        }
      }
    };

    window.addEventListener("message", onMessage);
    /*
     * The frame drops anything sent before it has booted, so the handshake
     * repeats until it answers — then stops.
     */
    const hello = () => post({ event: "listening", id: 1, channel: "widget" });
    hello();
    const tick = setInterval(() => {
      if (readyRef.current) clearInterval(tick);
      else hello();
    }, 400);
    const giveUp = setTimeout(() => clearInterval(tick), 15000);

    /*
     * A frame that navigates has a new player inside that has heard nothing.
     * Whatever the old one had told us no longer applies, so the handshake
     * starts over — otherwise the new player sits there listening to nobody.
     */
    const onLoad = () => {
      setReadyFor(null);
      readyRef.current = false;
      hello();
    };
    frame.addEventListener("load", onLoad);

    return () => {
      clearInterval(tick);
      clearTimeout(giveUp);
      frame.removeEventListener("load", onLoad);
      window.removeEventListener("message", onMessage);
    };
  }, [enabled, frameKey, getFrame]);

  const send = useCallback(
    (func: "playVideo" | "pauseVideo") => {
      const win = getFrame()?.contentWindow;
      if (!win) return;
      win.postMessage(JSON.stringify({ event: "command", func, args: [] }), YT_ORIGIN);
      // Flip now; the confirming state message follows a beat later and the
      // icon should not wait for a round trip.
      setPlaying(func === "playVideo");
      lastCommand.current = { playing: func === "playVideo", at: Date.now() };
      lastReportedState.current = func === "playVideo";
    },
    [getFrame],
  );

  const toggle = useCallback(() => send(playingRef.current ? "pauseVideo" : "playVideo"), [send]);
  const play = useCallback(() => send("playVideo"), [send]);

  /** Where the frame is now, in seconds. 0 before it has said anything. */
  const getPosition = useCallback(() => positionRef.current, []);

  /**
   * Jump to a point in the track — what keeps two people listening together
   * actually together.
   *
   * `allowSeekAhead: true` so a jump past what has buffered still moves; the
   * player fetches the new range instead of stopping at the edge of the old one.
   */
  const seek = useCallback(
    (seconds: number) => {
      const win = getFrame()?.contentWindow;
      if (!win) return;
      win.postMessage(
        JSON.stringify({ event: "command", func: "seekTo", args: [Math.max(0, seconds), true] }),
        YT_ORIGIN,
      );
      /*
       * Pre-written so the next reading is not mistaken for a hand on the
       * scrubber (see the jump check above). If the player refuses the seek —
       * an iOS frame with no gesture inside it yet — its next reading simply
       * overwrites this with the truth.
       */
      positionRef.current = Math.max(0, seconds);
    },
    [getFrame],
  );

  /**
   * Swap the video inside the running player, which starts it playing.
   *
   * This is what keeps a queue moving in a background tab. A fresh iframe there
   * is a fresh autoplay decision, and Chrome does not grant one to a tab nobody
   * is looking at; the player already running has that permission and keeps it.
   * It needs no new handshake either — this frame answered long ago.
   */
  const loadVideo = useCallback(
    (videoId: string) => {
      const win = getFrame()?.contentWindow;
      if (!win) return;
      win.postMessage(
        JSON.stringify({ event: "command", func: "loadVideoById", args: [videoId] }),
        YT_ORIGIN,
      );
      setPlaying(true);
    },
    [getFrame],
  );

  return { playing, readyFor, toggle, play, loadVideo, seek, getPosition };
}
