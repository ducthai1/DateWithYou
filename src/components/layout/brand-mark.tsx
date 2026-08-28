"use client";

import Image from "next/image";
import { useTone } from "@/components/theme/tone-provider";
import { logoSrc } from "@/lib/tone";

/**
 * The Vivu logo, in the tone that is currently showing.
 *
 * Two shapes, because the mark is used in two shapes of box. `wordmark` is the
 * wide lockup for the header and sidebar; `icon` is the square V for anywhere
 * that gives it a square — the welcome dialog was putting the wide lockup in a
 * 24px square, which shrank the whole lockup to a few illegible pixels.
 *
 * `object-contain` on both, so a caller that hands it an odd box gets a
 * smaller logo rather than a stretched or cropped one.
 */
export function BrandMark({
  className,
  variant = "wordmark",
  priority = false,
}: {
  className?: string;
  variant?: "wordmark" | "icon";
  /** Set on the one instance that is above the fold. */
  priority?: boolean;
}) {
  const { tone } = useTone();
  return (
    <div className={`relative ${className}`}>
      <Image
        src={logoSrc(variant, tone)}
        alt="Vivu No Plan"
        fill
        priority={priority}
        className="object-contain"
        sizes={variant === "icon" ? "64px" : "176px"}
      />
    </div>
  );
}
