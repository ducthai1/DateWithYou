"use client";

import { motion } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      // Keep the route transition cheap: a short opacity + translate fade. The
      // previous blur() filter animation forced a full-frame repaint on every
      // navigation, which read as lag (worse on mobile GPUs).
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
