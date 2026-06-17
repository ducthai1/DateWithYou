"use client";

// Wraps a list of direct children and staggers their entrance with a short
// y-offset + fade. 30ms step keeps it snappy without feeling mechanical.
// Respects prefers-reduced-motion via framer-motion's useReducedMotion — when
// motion is reduced the children render instantly with no animation.

import { isValidElement } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface StaggerListProps {
  children: React.ReactNode;
  className?: string;
  /** Gap between items as a Tailwind class (default: space-y-3) */
  gap?: string;
}

const CONTAINER = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.03, // 30ms step
    },
  },
};

const ITEM_VISIBLE = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: [0.16, 1, 0.3, 1] as number[], // --ease-spring
    },
  },
};

// Instant variant for reduced-motion — same structure so framer doesn't warn.
const ITEM_INSTANT = {
  hidden: { opacity: 1, y: 0 },
  show: { opacity: 1, y: 0 },
};

/**
 * Staggers direct children into view (y:6→0, fade) on first mount.
 * Reduced-motion users see children immediately with no animation.
 */
export function StaggerList({ children, className, gap = "space-y-3" }: StaggerListProps) {
  const reduced = useReducedMotion();
  const itemVariant = reduced ? ITEM_INSTANT : ITEM_VISIBLE;

  return (
    <motion.div
      className={className ?? gap}
      variants={CONTAINER}
      initial="hidden"
      animate="show"
    >
      {/* Wrap each child in a motion.div so variants propagate correctly. */}
      {Array.isArray(children)
        ? children.map((child, i) => (
            // Prefer the child's own key so reorder/remove animates correctly;
            // fall back to index only for unkeyed children.
            <motion.div
              key={isValidElement(child) && child.key != null ? child.key : i}
              variants={itemVariant}
              className="min-w-0"
            >
              {child}
            </motion.div>
          ))
        : <motion.div variants={itemVariant} className="min-w-0">{children}</motion.div>}
    </motion.div>
  );
}
