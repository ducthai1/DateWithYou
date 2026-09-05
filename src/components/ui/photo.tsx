"use client";

import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes } from "react";
import { ImageOff } from "lucide-react";
import { cldPreview, cldThumb } from "@/lib/cloudinary-url";
import { cn } from "@/lib/utils";

/**
 * A photo that arrives without shoving anything around.
 *
 * Three things, together, are what made a day with thirty pictures stutter:
 * the stored URL is the original upload and was being drawn at thumbnail size;
 * every picture decoded on the main thread as it landed; and nothing held the
 * space until it did, so the grid jumped with each arrival. So —
 *
 * - the URL is rewritten to the size actually shown (Cloudinary does the
 *   resize; the same stored URL serves every size),
 * - the box is sized before the bytes exist and shows a quiet pulse until they
 *   do, then the picture fades in over it,
 * - decoding is off the main thread and loading is lazy, so a picture below
 *   the fold costs nothing until it is scrolled to.
 *
 * A picture already in the browser's cache skips the pulse entirely — a
 * skeleton flashing over something that is instantly available reads as a bug.
 */

type Variant =
  /** Square crop at `size` px (CSS px; Cloudinary doubles it for retina). */
  | { variant: "thumb"; size?: number }
  /** Scaled to fit within `width`, original aspect. */
  | { variant: "preview"; width?: number };

type Props = Variant &
  Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    src: string;
    alt?: string;
    /** Classes for the frame: size, rounding, cursor. */
    className?: string;
    /** Classes for the picture itself, e.g. `object-top`. */
    imgClassName?: string;
    style?: CSSProperties;
    /** Above the fold: fetch now, at high priority, instead of lazily. */
    priority?: boolean;
  };

export function Photo(props: Props) {
  const { src, alt = "", className, imgClassName, style, priority = false, variant, ...rest } = props;
  // `size` and `width` each belong to one variant; whatever is left is for the
  // frame (PhotoView's onClick lands there).
  const { size, width, ...frameProps } = rest as { size?: number; width?: number } & HTMLAttributes<HTMLDivElement>;
  const url = variant === "thumb" ? cldThumb(src, size ?? 400) : cldPreview(src, width ?? 1000);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  // Cached already: the load event has fired before React attached to it.
  useEffect(() => {
    const el = imgRef.current;
    if (el?.complete && el.naturalWidth > 0) setState("ready");
  }, [url]);

  return (
    <div
      {...frameProps}
      style={style}
      className={cn("bg-muted relative overflow-hidden", className)}
    >
      {state === "loading" && (
        <span aria-hidden className="bg-muted absolute inset-0 animate-pulse" />
      )}
      {state === "failed" ? (
        <span aria-hidden className="text-muted-foreground/60 absolute inset-0 grid place-items-center">
          <ImageOff className="h-5 w-5" />
        </span>
      ) : (
        <img
          ref={imgRef}
          src={url}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          onLoad={() => setState("ready")}
          onError={() => setState("failed")}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300",
            state === "ready" ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
        />
      )}
    </div>
  );
}
