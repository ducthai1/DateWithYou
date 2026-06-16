import { cn } from "@/lib/utils";

type SkeletonVariant = "rect" | "card" | "text";

interface SkeletonProps {
  /** Controls the shape composition rendered.
   *  - rect  (default): single rectangle — matches the previous API exactly.
   *  - card : image block + two text lines — mirrors a media/memory card silhouette.
   *  - text : a short single line, useful for inline label placeholders.
   */
  variant?: SkeletonVariant;
  className?: string;
}

/** Reusable pulse base so individual bones share the same animation class. */
function Bone({ className }: { className?: string }) {
  return <div className={cn("bg-muted animate-pulse rounded-xl", className)} />;
}

/**
 * Loading skeleton with shape variants.
 *
 * Usage:
 *   <Skeleton />                        // rect (existing behaviour)
 *   <Skeleton variant="card" />         // image + 2 text lines
 *   <Skeleton variant="text" className="w-32" />
 */
export function Skeleton({ variant = "rect", className }: SkeletonProps) {
  if (variant === "card") {
    /*
     * Card silhouette: tall image block on top, two text lines below.
     * Matches a typical media / memory card layout so the transition from
     * skeleton → real card has no jarring shape jump.
     */
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {/* Image / cover block */}
        <Bone className="h-40 w-full rounded-xl" />
        {/* Primary text line */}
        <Bone className="h-4 w-3/4 rounded-md" />
        {/* Secondary / subtitle line */}
        <Bone className="h-3 w-1/2 rounded-md" />
      </div>
    );
  }

  if (variant === "text") {
    /* Single short line — for inline label / heading placeholders. */
    return <Bone className={cn("h-4 w-24 rounded-md", className)} />;
  }

  /* rect — original behaviour, unchanged for backward compatibility. */
  return <Bone className={cn("rounded-xl", className)} />;
}
