"use client";

// Wraps a list of direct children and staggers their entrance with a short
// y-offset + fade. The step is small AND capped — see STAGGER_CAP.
// Respects prefers-reduced-motion via framer-motion's useReducedMotion — when
// motion is reduced the children render instantly with no animation.

import { isValidElement } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

interface StaggerListProps {
  children: React.ReactNode;
  className?: string;
  /** Gap between items as a Tailwind class (default: space-y-3) */
  gap?: string;
}

/*
 * Bậc thang CÓ TRẦN, không phải bậc thang vô hạn.
 *
 * `staggerChildren` nhân với chỉ số, nên một lưới 24 thẻ (một trang kỷ niệm)
 * có thẻ cuối **bắt đầu** hiện ở 690ms và xong ở ~940ms — rồi từng ảnh trong
 * nó lại tự mờ dần 300ms nữa. Đó đúng là "các mảng hình cứ load dần dần" mà
 * chủ repo thấy, và nó là hoạt ảnh do mình viết chứ không phải mạng chậm.
 *
 * `staggerChildren` là độ trễ, không có tham số "tối đa", nên trần đặt bằng số
 * phần tử được xếp bậc: quá `STAGGER_CAP` thì mọi thẻ còn lại hiện cùng nhau.
 * Nhịp vào màn vẫn còn ở những thẻ mắt thật sự nhìn, phần dưới màn thì không
 * ai được lợi vì phải đợi.
 */
const STEP = 0.028;
const STAGGER_CAP = 8;

const CONTAINER: Variants = { hidden: {}, show: {} };

const ITEM_VISIBLE: Variants = {
  hidden: { opacity: 0, y: 6 },
  // Độ trễ tính theo chỉ số nhưng CÓ TRẦN — `staggerChildren` không có trần nên
  // phải tự tính ở đây, xem ghi chú trên `STAGGER_CAP`.
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      delay: Math.min(i, STAGGER_CAP) * STEP,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number], // --ease-spring
    },
  }),
};

// Instant variant for reduced-motion — same structure so framer doesn't warn.
const ITEM_INSTANT: Variants = {
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
              custom={i}
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
