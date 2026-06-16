"use client";

// Zero-dependency one-shot heart-burst celebration. Mounts a small overlay of
// hearts/sparkles that float upward then fade, then removes itself from the
// DOM. No confetti library needed — pure CSS keyframes injected once.
// Respects prefers-reduced-motion: useCelebrate() is a no-op when motion is
// reduced so no animation fires at all.

import { useCallback, useRef } from "react";

// Keyframes injected once into <head> the first call. The animation runs
// entirely in CSS so there's no JS frame loop while the burst plays.
const STYLE_ID = "celebrate-keyframes";

function ensureStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
@keyframes celebrate-rise {
  0%   { opacity: 1; transform: translateY(0) scale(1) rotate(var(--cr, 0deg)); }
  70%  { opacity: 0.9; }
  100% { opacity: 0; transform: translateY(var(--cy, -80px)) scale(0.6) rotate(var(--cr2, 20deg)); }
}
.celebrate-particle {
  position: absolute;
  bottom: 50%;
  left: 50%;
  font-size: var(--csz, 1.1rem);
  animation: celebrate-rise var(--cd, 600ms) var(--ce, cubic-bezier(0.16,1,0.3,1)) var(--cdel, 0ms) both;
  pointer-events: none;
  user-select: none;
  will-change: transform, opacity;
}
`;
  document.head.appendChild(s);
}

const GLYPHS = ["❤️", "✨", "💕", "⭐", "💗"];

/**
 * Imperatively fires a one-shot heart-burst anchored to the given element
 * (or document.body if no ref is provided). Particles float up and fade out,
 * then the wrapper div removes itself. No state, no re-render.
 *
 * Reduced-motion: checks `window.matchMedia` before creating anything — the
 * call is a complete no-op when the user prefers reduced motion.
 */
export function useCelebrate() {
  // Track live burst wrappers so rapid repeated calls don't stack unboundedly.
  const activeRef = useRef(0);

  const celebrate = useCallback((anchorEl?: HTMLElement | null) => {
    if (typeof window === "undefined") return;
    // Honour system preference without pulling in a framer hook — this utility
    // is intentionally dependency-free from React motion hooks.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Limit concurrent bursts to avoid chaos on rapid taps.
    if (activeRef.current >= 3) return;

    ensureStyles();

    const count = 7;
    const anchor = anchorEl ?? document.body;
    const wrapper = document.createElement("div");
    wrapper.style.cssText =
      "position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:9999;";

    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      p.className = "celebrate-particle";
      const glyph = GLYPHS[i % GLYPHS.length];
      p.textContent = glyph;
      // Spread horizontally around the anchor centre.
      const xOff = (Math.random() - 0.5) * 120;
      const yOff = 60 + Math.random() * 60; // 60–120 px upward
      const rot1 = `${(Math.random() - 0.5) * 20}deg`;
      const rot2 = `${(Math.random() - 0.5) * 40}deg`;
      const size = `${0.85 + Math.random() * 0.5}rem`;
      const delay = `${i * 45}ms`;
      const dur = `${480 + Math.random() * 200}ms`;
      p.style.cssText += `
        --cy: -${yOff}px;
        --cr: ${rot1};
        --cr2: ${rot2};
        --csz: ${size};
        --cdel: ${delay};
        --cd: ${dur};
        margin-left: ${xOff}px;
      `;
      wrapper.appendChild(p);
    }

    anchor.style.position ||= "relative";
    anchor.appendChild(wrapper);
    activeRef.current += 1;

    // The longest particle is ~480+200+count*45 ≈ 1000ms. Clean up after that.
    const totalMs = 480 + 200 + count * 45 + 100;
    setTimeout(() => {
      wrapper.remove();
      activeRef.current = Math.max(0, activeRef.current - 1);
    }, totalMs);
  }, []);

  return celebrate;
}
