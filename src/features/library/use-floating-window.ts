"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Position and width of a draggable, resizable floating panel, remembered
 * between visits.
 *
 * Only the width is user-controlled; height follows the media's aspect. That is
 * what a video window wants — a free-form height would either letterbox the
 * frame or squash it.
 */

/** Which corner is being pulled. "move" drags the whole panel. */
export type DragMode = "move" | "nw" | "ne" | "sw" | "se";

export type WindowBox = {
  /** Outer width in px. */
  w: number;
  /** Left/top in px. Null means "still parked at the default corner". */
  x: number | null;
  y: number | null;
};

const MARGIN = 8;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

export function useFloatingWindow({
  storageKey,
  minWidth,
  maxWidth,
  heightFor,
}: {
  storageKey: string;
  minWidth: number;
  maxWidth: number;
  /**
   * Panel height for a given width, computed rather than measured.
   *
   * A top-corner pull has to hold the bottom edge still, which needs the new
   * height *before* it is laid out. Reading `offsetHeight` instead lost the
   * race: `pointerup` arrives before React has flushed the last move's render,
   * so the read returned the previous height and the bottom edge slid ~28px per
   * pull — and which corner it hit changed run to run.
   */
  heightFor?: (w: number) => number;
}) {
  const heightForRef = useRef(heightFor);
  heightForRef.current = heightFor;
  const boxRef = useRef<HTMLDivElement | null>(null);
  /*
   * Starts null so the server and the first client render agree; the stored
   * box — or a width picked from the viewport — arrives on mount.
   */
  const [box, setBox] = useState<WindowBox | null>(null);
  const drag = useRef<
    { mode: DragMode; px: number; py: number; x: number; y: number; w: number; h: number; bottom: number } | null
  >(null);

  useEffect(() => {
    const vw = window.innerWidth;
    // A phone gets a genuinely small window; the old one filled the screen.
    const fallback: WindowBox = { w: Math.min(vw < 640 ? 224 : 320, vw - MARGIN * 2), x: null, y: null };
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return setBox(fallback);
      const saved = JSON.parse(raw) as Partial<WindowBox>;
      setBox({
        w: clamp(Number(saved.w) || fallback.w, minWidth, Math.min(maxWidth, vw - MARGIN * 2)),
        x: typeof saved.x === "number" ? saved.x : null,
        y: typeof saved.y === "number" ? saved.y : null,
      });
    } catch {
      setBox(fallback);
    }
  }, [storageKey, minWidth, maxWidth]);

  const persist = useCallback(
    (next: WindowBox) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* Private mode, or storage full — the window still works, just forgets. */
      }
    },
    [storageKey],
  );

  /*
   * The drag listens on `window`, not on the handle, and does not use
   * `setPointerCapture`.
   *
   * Capture was tried first and dropped the gesture: `pointerdown` arrived,
   * `pointermove` never did. Window listeners are also the only thing that
   * survives the pointer crossing the iframe — a frame swallows its own
   * pointer events, and a drag that dies the moment the cursor passes over the
   * video is no drag at all. A held mouse button keeps events coming to the
   * document that started the gesture, which is exactly what this needs.
   */
  const onPointerDown = useCallback(
    (mode: DragMode) => (e: React.PointerEvent) => {
      const el = boxRef.current;
      if (!el || !box) return;
      // Buttons inside the frame keep their clicks.
      if (mode === "move" && (e.target as HTMLElement).closest("button,a,input,select")) return;
      const rect = el.getBoundingClientRect();
      drag.current = {
        mode, px: e.clientX, py: e.clientY,
        x: rect.left, y: rect.top, w: rect.width, h: rect.height,
        // The edge a top-corner pull has to hold still.
        bottom: rect.bottom,
      };
      /*
       * A corner pull needs concrete left/top to anchor the opposite edge
       * against. Until the first drag the panel is parked by CSS with no
       * coordinates, so they are taken from where it actually sits.
       */
      if (mode !== "move") setBox((cur) => (cur ? { ...cur, x: rect.left, y: rect.top } : cur));

      const onMove = (ev: PointerEvent) => {
        const d = drag.current;
        const node = boxRef.current;
        if (!d || !node) return;
        const dx = ev.clientX - d.px;
        const dy = ev.clientY - d.py;
        const h = node.offsetHeight;
        setBox((cur) => {
          if (!cur) return cur;
          if (d.mode === "move") {
            return {
              ...cur,
              x: clamp(d.x + dx, MARGIN, Math.max(MARGIN, window.innerWidth - d.w - MARGIN)),
              y: clamp(d.y + dy, MARGIN, Math.max(MARGIN, window.innerHeight - h - MARGIN)),
            };
          }
          const fromLeft = d.mode === "nw" || d.mode === "sw";
          const fromTop = d.mode === "nw" || d.mode === "ne";
          // Pulling a left corner widens leftwards, so the delta flips sign.
          const room = fromLeft ? d.x + d.w - MARGIN : window.innerWidth - d.x - MARGIN;
          const w = clamp(fromLeft ? d.w - dx : d.w + dx, minWidth, Math.min(maxWidth, room));
          /* The edge you are NOT holding stays put. */
          const x = fromLeft ? d.x + (d.w - w) : d.x;
          const h1 = heightForRef.current?.(w) ?? h;
          const y = fromTop
            ? clamp(d.bottom - h1, MARGIN, Math.max(MARGIN, window.innerHeight - h1 - MARGIN))
            : d.y;
          return { w, x, y };
        });
      };
      const onUp = () => {
        drag.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        setBox((cur) => {
          if (cur) persist(cur);
          return cur;
        });
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      e.preventDefault();
    },
    [box, minWidth, maxWidth, persist],
  );

  /* A rotated phone or a resized window must not leave the panel off-screen. */
  useEffect(() => {
    const onResize = () =>
      setBox((cur) => {
        if (!cur) return cur;
        const el = boxRef.current;
        const h = el?.offsetHeight ?? 200;
        const w = clamp(cur.w, minWidth, Math.min(maxWidth, window.innerWidth - MARGIN * 2));
        return {
          w,
          x: cur.x == null ? null : clamp(cur.x, MARGIN, Math.max(MARGIN, window.innerWidth - w - MARGIN)),
          y: cur.y == null ? null : clamp(cur.y, MARGIN, Math.max(MARGIN, window.innerHeight - h - MARGIN)),
        };
      });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [minWidth, maxWidth]);

  const reset = useCallback(() => {
    const vw = window.innerWidth;
    const next: WindowBox = { w: Math.min(vw < 640 ? 224 : 320, vw - MARGIN * 2), x: null, y: null };
    setBox(next);
    persist(next);
  }, [persist]);

  return {
    boxRef,
    box,
    reset,
    /** Spread on the title strip and the frame's padding. */
    moveProps: { onPointerDown: onPointerDown("move") },
    /** Spread on each of the four corner grips. */
    cornerProps: (corner: Exclude<DragMode, "move">) => ({ onPointerDown: onPointerDown(corner) }),
  };
}
