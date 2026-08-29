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
  sizes = "(max-width: 768px) 100vw, 720px",
}: {
  name: ArtName;
  alt?: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const { tone } = useTone();
  return (
    <Image
      src={artSrc(name, tone)}
      alt={alt}
      aria-hidden={alt === "" ? true : undefined}
      width={1672}
      height={941}
      priority={priority}
      sizes={sizes}
      className={cn("h-auto w-full object-cover", className)}
    />
  );
}
