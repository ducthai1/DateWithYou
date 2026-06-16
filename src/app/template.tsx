"use client";

import { motion, useReducedMotion } from "framer-motion";

// Re-mounts on every route change (App Router template.tsx semantics), so this
// is the natural place for the page-entrance transition. Keep it cheap:
// opacity + small y-rise only — no blur filter (forced repaint on mobile GPUs).
// Reduced-motion: framer's useReducedMotion disables the animation entirely so
// reduced-motion users get an instant render.

export default function Template({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      // Duration uses --dur-fast (150ms) token value so it stays in sync with
      // any future token changes. Ease matches --ease-spring.
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
