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

/** Player states the widget reports. Only "playing" needs naming. */
const PLAYING = 1;

/** Adds the flag the protocol needs, keeping whatever the stored URL had. */
export function withJsApi(embedUrl: string, pageOrigin: string): string {
  try {
    const u = new URL(embedUrl);
    u.searchParams.set("enablejsapi", "1");
    // YouTube wants to know who is talking to it; without this it warns.
    if (pageOrigin) u.searchParams.set("origin", pageOrigin);
    return u.toString();
  } catch {
    return embedUrl;
  }
}

export function useYouTubePlayback(
  getFrame: () => HTMLIFrameElement | null,
  enabled: boolean,
  /** Changes per track, so a new video starts from an unknown state. */
  trackKey: string,
) {
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const playingRef = useRef(false);
  playingRef.current = playing;
  const readyRef = useRef(false);
  readyRef.current = ready;

  useEffect(() => {
    setPlaying(false);
    setReady(false);
  }, [trackKey]);

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
      setReady(true);
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
      if (state != null) setPlaying(state === PLAYING);
    };

    window.addEventListener("message", onMessage);
    /*
     * The frame drops anything sent before it has booted, and there is no load
     * event to wait on from the outside, so the handshake repeats until it
     * answers — then stops.
     */
    const hello = () => post({ event: "listening", id: 1, channel: "widget" });
    hello();
    const tick = setInterval(() => {
      if (readyRef.current) clearInterval(tick);
      else hello();
    }, 400);
    const giveUp = setTimeout(() => clearInterval(tick), 15000);

    return () => {
      clearInterval(tick);
      clearTimeout(giveUp);
      window.removeEventListener("message", onMessage);
    };
  }, [enabled, trackKey, getFrame]);

  const toggle = useCallback(() => {
    const win = getFrame()?.contentWindow;
    if (!win) return;
    const next = !playingRef.current;
    win.postMessage(
      JSON.stringify({ event: "command", func: next ? "playVideo" : "pauseVideo", args: [] }),
      YT_ORIGIN,
    );
    // Flip now; the confirming state message follows a beat later and the icon
    // should not wait for a round trip.
    setPlaying(next);
  }, [getFrame]);

  return { playing, ready, toggle };
}
