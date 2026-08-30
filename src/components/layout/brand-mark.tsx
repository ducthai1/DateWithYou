"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTone } from "@/components/theme/tone-provider";
import { logoSrc } from "@/lib/tone";

/**
 * Milliseconds until the top of the next hour.
 *
 * Same shape as `msUntilNextToneChange` in lib/tone.ts, but aimed at every
 * hour boundary instead of just the morning/afternoon one — the wordmark pair
 * flips every hour, not twice a day.
 */
function msUntilNextHour(now: Date): number {
  const next = new Date(now);
  next.setHours(now.getHours() + 1, 0, 0, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}

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

  /*
   * `hour` starts `undefined`, not `new Date().getHours()`: the server has no
   * notion of the reader's local time, so a value read during render would
   * make server and client disagree — a hydration mismatch, the same failure
   * ToneProvider avoids by rendering a server-resolved tone first. Left
   * `undefined`, `logoSrc` already returns the deterministic first file of the
   * pair (see its call signature), which is what the server renders too, so
   * the first paint needs no separate "ready" flag — the sentinel itself
   * plays that role. The real hour is substituted in after mount, then kept
   * current by a timer aimed at the next hour boundary, the same pattern
   * ToneProvider's clock effect uses for the tone.
   */
  const [hour, setHour] = useState<number | undefined>(undefined);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = new Date();
      setHour(now.getHours());
      timer = setTimeout(schedule, msUntilNextHour(now));
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <Image
        src={logoSrc(variant, tone, hour)}
        alt="Vivu No Plan"
        fill
        priority={priority}
        className="object-contain"
        sizes={variant === "icon" ? "64px" : "176px"}
      />
    </div>
  );
}
