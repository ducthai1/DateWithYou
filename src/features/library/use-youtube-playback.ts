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
) {
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
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
  const readyRef = useRef(false);
  readyRef.current = readyFor === frameKey;

  useEffect(() => {
    setPlaying(false);
    setReadyFor(null);
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
      const state =
        typeof info === "number"
          ? info
          : typeof (info as { playerState?: number })?.playerState === "number"
            ? (info as { playerState: number }).playerState
            : null;
      if (state != null) {
        setPlaying(state === PLAYING);
        if (state === ENDED) endedRef.current?.();
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
    },
    [getFrame],
  );

  const toggle = useCallback(() => send(playingRef.current ? "pauseVideo" : "playVideo"), [send]);
  const play = useCallback(() => send("playVideo"), [send]);

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

  return { playing, readyFor, toggle, play, loadVideo };
}
