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

const FPS = 12;
const TICK_MS = 1000 / FPS;

/**
 * The draw loop runs on a timer inside a Worker.
 *
 * rAF is frozen in a hidden tab, and a main-thread timer there is cut to one
 * tick a second — and the window exists precisely for the hidden tab. At one
 * frame a second the route crawled and the map stepped. A worker's timer is
 * not throttled that way; its message is what drives each frame here.
 */
const TICKER_SRC = `let t=null;onmessage=e=>{clearInterval(t);if(e.data>0)t=setInterval(()=>postMessage(0),e.data)}`;

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
  /**
   * Lay the video across the whole viewport instead of parking it at 1px.
   *
   * This is the Android path to a window that opens by itself. The only thing
   * Chrome on Android sends to picture-in-picture when Home is pressed is a
   * playing video it considers fullscreen — and it grants that to a video that
   * fills the viewport inside a fullscreen document, which is exactly how a
   * fullscreen YouTube embed gets there. The page goes fullscreen when the ride
   * starts; this makes the stream the video that qualifies. It sits behind
   * everything else, so nothing on screen changes.
   */
  immersive?: boolean;
};

export function useNavMiniWindow(
  frame: MiniNavFrame,
  { enabled, autoOpen, immersive = false }: MiniWindowOptions,
) {
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<VideoWithPip | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const workerRef = useRef<Worker | null>(null);
  /** The capture track, so each paint can push its frame explicitly. */
  const trackRef = useRef<(MediaStreamTrack & { requestFrame?: () => void }) | null>(null);
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
    /*
     * Push the frame ourselves. A frame-rate capture only emits when the
     * browser gets round to compositing the canvas, and a hidden tab may not
     * get round to it at all — the small window then opened black with a
     * spinner and stayed that way. An explicit frame per paint does not depend
     * on the compositor.
     */
    trackRef.current?.requestFrame?.();
  }, []);

  const startTicker = useCallback(() => {
    if (timerRef.current || workerRef.current) return;
    try {
      const w = new Worker(URL.createObjectURL(new Blob([TICKER_SRC], { type: "text/javascript" })));
      w.onmessage = paint;
      w.postMessage(TICK_MS);
      workerRef.current = w;
    } catch {
      // No workers here — a main-thread timer is throttled when hidden, but it
      // is the loop that exists.
      timerRef.current = setInterval(paint, TICK_MS);
    }
  }, [paint]);

  const stopTicker = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (workerRef.current) {
      workerRef.current.postMessage(0);
      workerRef.current.terminate();
      workerRef.current = null;
    }
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
       * Chrome refuses PiP for a video that is `display:none`, so it is either
       * a 1px transparent square or, in immersive mode, a full-viewport layer
       * underneath the page. Both pinned *inside* the viewport on purpose: a
       * far-off-screen offset is how elements end up widening the page.
       */
      video.style.cssText = immersive
        ? "position:fixed;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;z-index:-1"
        : "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1";
      video.addEventListener("enterpictureinpicture", () => setActive(true));
      video.addEventListener("leavepictureinpicture", () => setActive(false));
      document.body.appendChild(video);
      videoRef.current = video;
    }

    const video = videoRef.current;
    if (!video.srcObject) {
      const canvas = canvasRef.current;
      // 0: frames are pushed by paint() via requestFrame, not sampled by the browser.
      const stream = (canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream })
        .captureStream?.(0);
      if (!stream) return null;
      trackRef.current = stream.getVideoTracks()[0] ?? null;
      video.srcObject = stream;
      paint();
    }
    if (video.paused) await video.play().catch(() => {});

    startTicker();
    return video;
  }, [paint, immersive, startTicker]);

  /**
   * A frame has to exist before the window is asked for. Requested on a video
   * with nothing decoded yet, Android opened a black 16:9 window with a spinner
   * — the default shape, because it did not know the video's size either.
   */
  const waitForFrame = useCallback(
    (video: HTMLVideoElement) =>
      new Promise<void>((resolve) => {
        if (video.readyState >= 2 && video.videoWidth > 0) return resolve();
        const done = () => {
          video.removeEventListener("loadeddata", done);
          resolve();
        };
        video.addEventListener("loadeddata", done);
        paint();
        setTimeout(done, 1500);
      }),
    [paint],
  );

  const open = useCallback(async () => {
    try {
      const video = await ensurePipe();
      if (!video) return false;
      await waitForFrame(video);
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
  }, [ensurePipe, waitForFrame]);

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
    stopTicker();
    void close();
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
      video.remove();
      videoRef.current = null;
    }
    trackRef.current = null;
    canvasRef.current = null;
  }, [enabled, close, stopTicker]);

  useEffect(
    () => () => {
      stopTicker();
      videoRef.current?.remove();
    },
    [stopTicker],
  );

  return { supported, active, open, close };
}
