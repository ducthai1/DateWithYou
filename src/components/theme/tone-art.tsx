"use client";

import Image from "next/image";
import { useTone } from "./tone-provider";
import { artSrc, type ArtName } from "@/lib/tone";
import { cn } from "@/lib/utils";

/**
 * A piece of brand artwork in whichever tone is showing.
 *
 * Client-side because the tone can depend on the reader's clock. On a page the
 * server rendered from the cookie the first paint is already right; on a static
 * marketing page it paints the fallback tone and corrects on mount, which for a
 * decorative image is a fair trade against making those pages dynamic.
 *
 * `alt=""` by default: these illustrate what the words already say, so a screen
 * reader announcing them twice is noise. Pass `alt` where the picture carries
 * information of its own.
 */
export function ToneArt({
  name,
  alt = "",
  className,
  priority = false,
  fill = false,
  position,
  sizes = "(max-width: 768px) 100vw, 720px",
}: {
  name: ArtName;
  alt?: string;
  className?: string;
  priority?: boolean;
  /** Sit BEHIND content — the parent sets the box. Parent needs `relative`. */
  fill?: boolean;
  /** CSS object-position, e.g. "center 30%" — which part survives the crop. */
  position?: string;
  sizes?: string;
}) {
  const { tone } = useTone();
  const common = {
    src: artSrc(name, tone),
    "aria-hidden": alt === "" ? true : undefined,
    priority,
    sizes,
    style: position ? { objectPosition: position } : undefined,
  } as const;

  /*
   * Two modes, because artwork does two different jobs.
   *
   * Default is intrinsic: the image carries its own 1672x941 box and the layout
   * grows around it — right when the picture IS the content.
   *
   * `fill` hands sizing to the parent, for a picture that sits behind content:
   * a header band, a card cover, one half of a split hero. Those parents own
   * the height, and an intrinsic image inside them either overflows or
   * collapses to nothing.
   */
  if (fill) {
    return <Image {...common} alt={alt} fill className={cn("object-cover", className)} />;
  }
  return (
    <Image
      {...common}
      alt={alt}
      width={1672}
      height={941}
      className={cn("h-auto w-full object-cover", className)}
    />
  );
}
