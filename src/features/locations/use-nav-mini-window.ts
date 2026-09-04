"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { drawMiniNav, MINI_H, MINI_W, type MiniNavFrame } from "./nav-mini-canvas";

/**
 * A floating turn card that survives leaving the app, the way a map app's
 * small window does.
 *
 * It is a *drawn* window, not a screenshot of the map: at this size map tiles
 * and street labels are unreadable, and capturing MapLibre's WebGL canvas
 * would need `preserveDrawingBuffer`, which costs a frame buffer copy on every
 * frame of the real map for the whole trip.
 *
 * The pipe is canvas → captureStream → <video> → Picture-in-Picture, which is
 * the only floating-window API a web page gets. Document PiP would allow real
 * DOM, but it is desktop-only; video PiP is what phones actually support.
 */

const FPS = 4;

/** rAF is frozen in a hidden tab — the exact moment this window has to keep
 * drawing — so the loop runs on a timer instead. */
const TICK_MS = 1000 / FPS;

type VideoWithPip = HTMLVideoElement & {
  autoPictureInPicture?: boolean;
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
};

export type MiniWindowOptions = {
  /** Keep the canvas/stream alive. Stays true across a pause so resuming is instant. */
  enabled: boolean;
  /** Pop the window when the app goes to the background. Off while paused —
   * a stopped trip has nothing to follow, and a window nobody asked for is rude. */
  autoOpen: boolean;
};

export function useNavMiniWindow(frame: MiniNavFrame, { enabled, autoOpen }: MiniWindowOptions) {
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<VideoWithPip | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const video = document.createElement("video") as VideoWithPip;
    setSupported(
      (document.pictureInPictureEnabled === true && !video.disablePictureInPicture) ||
        typeof video.webkitSetPresentationMode === "function",
    );
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = canvas.width / MINI_W;
    ctx.save();
    ctx.scale(dpr, dpr);
    drawMiniNav(ctx, frameRef.current);
    ctx.restore();
  }, []);

  /** Builds the canvas/video pair once and starts the draw loop. */
  const ensurePipe = useCallback(async () => {
    if (!canvasRef.current) {
      const canvas = document.createElement("canvas");
      // Drawn at 2× so the text stays sharp when the window is scaled up.
      canvas.width = MINI_W * 2;
      canvas.height = MINI_H * 2;
      canvasRef.current = canvas;
    }
    paint();

    if (!videoRef.current) {
      const video = document.createElement("video") as VideoWithPip;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.autoPictureInPicture = true;
      /*
       * Chrome refuses PiP for a video that is `display:none`, so it is a 1px
       * transparent square instead. Pinned *inside* the viewport on purpose:
       * a far-off-screen offset is how elements end up widening the page.
       */
      video.style.cssText =
        "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1";
      video.addEventListener("enterpictureinpicture", () => setActive(true));
      video.addEventListener("leavepictureinpicture", () => setActive(false));
      document.body.appendChild(video);
      videoRef.current = video;
    }

    const video = videoRef.current;
    if (!video.srcObject) {
      const canvas = canvasRef.current;
      const stream = (canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream })
        .captureStream?.(FPS);
      if (!stream) return null;
      video.srcObject = stream;
    }
    if (video.paused) await video.play().catch(() => {});

    if (!timerRef.current) timerRef.current = setInterval(paint, TICK_MS);
    return video;
  }, [paint]);

  const open = useCallback(async () => {
    try {
      const video = await ensurePipe();
      if (!video) return false;
      if (typeof video.webkitSetPresentationMode === "function" && !document.pictureInPictureEnabled) {
        video.webkitSetPresentationMode("picture-in-picture");
        setActive(true);
        return true;
      }
      await video.requestPictureInPicture();
      return true;
    } catch {
      return false;
    }
  }, [ensurePipe]);

  const close = useCallback(async () => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      videoRef.current?.webkitSetPresentationMode?.("inline");
    } catch {
      /* Already gone — nothing to leave. */
    }
    setActive(false);
  }, []);

  /*
   * While navigating, the stream is kept warm even before the window is asked
   * for: `autoPictureInPicture` only fires on a video that is already playing,
   * and building the pipe at hide-time is too late.
   */
  useEffect(() => {
    if (!enabled || !supported) return;
    void ensurePipe();
  }, [enabled, supported, ensurePipe]);

  /*
   * `autoPictureInPicture` covers installed PWAs. Everywhere else this asks
   * on the way out; without a fresh gesture the browser refuses, which is why
   * the manual button exists too.
   */
  useEffect(() => {
    if (!autoOpen || !supported) return;
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      if (document.pictureInPictureElement) return;
      void open();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [autoOpen, supported, open]);

  /** Navigation over — tear the whole pipe down, don't leave a window floating. */
  useEffect(() => {
    if (enabled) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    void close();
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
      video.remove();
      videoRef.current = null;
    }
    canvasRef.current = null;
  }, [enabled, close]);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      videoRef.current?.remove();
    },
    [],
  );

  return { supported, active, open, close };
}
