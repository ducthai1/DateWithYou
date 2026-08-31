"use client";

import Image from "next/image";
import { useTone } from "./tone-provider";
import { artIsTransparent, artSrc, spotIsTransparent, spotSrc, type ArtName, type SpotName } from "@/lib/tone";
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
  framed = false,
  position,
  sizes = "(max-width: 768px) 100vw, 720px",
}: {
  name: ArtName;
  alt?: string;
  className?: string;
  priority?: boolean;
  /** Sit BEHIND content — the parent sets the box. Parent needs `relative`. */
  fill?: boolean;
  /**
   * Wrap the picture in the card treatment the marketing surfaces use.
   *
   * It exists so the CALLER stops deciding. Nine places hand-rolled the same
   * rounded border and white fill, which is right for an opaque picture and
   * exactly wrong for a cut-out: the frame hands back the very box the
   * background removal took away, so a transparent piece reads as though
   * nothing had been removed.
   *
   * Opaque file: rounded card, hairline border, soft shadow.
   * Cut-out file: no card, and the shadow moves onto the artwork's own
   * silhouette so it still sits ON the page rather than flat against it.
   */
  framed?: boolean;
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
  const cut = artIsTransparent(name, tone);
  const img = (
    <Image
      {...common}
      alt={alt}
      width={1672}
      height={941}
      className={cn(
        "h-auto w-full object-cover",
        // A cut-out has no card edge to cast a shadow, so it casts its own.
        framed && cut && "drop-shadow-[0_14px_28px_rgba(59,50,42,0.22)]",
        className,
      )}
    />
  );

  if (!framed || cut) return img;

  return (
    <div className="overflow-hidden rounded-[28px] border border-[#d8cfc1]/70 bg-white/50 shadow-[0_12px_40px_rgba(59,50,42,0.08)]">
      {img}
    </div>
  );
}

/**
 * A single spot illustration — one object, tone-neutral, for a box far
 * smaller than a scene's own frame (a chip, a small empty state, a card
 * corner). Always `fill` + `object-contain`, never `object-cover`: a scene can
 * be cropped and still read as a scene, but cropping the one object a spot
 * shows just cuts it off. The measured files aren't a single aspect ratio
 * (some are square, some ~16:9, one ~2.3:1 — see tone.ts), so `contain` inside
 * whatever box the parent sets is what keeps every one of them undistorted
 * without needing a per-file width/height table here.
 *
 * No `useTone` here on purpose: spots carry no palette, so this needs no
 * client-only tone read the way `ToneArt` does.
 */
export function SpotArt({
  name,
  alt = "",
  className,
  sizes = "112px",
}: {
  name: SpotName;
  alt?: string;
  className?: string;
  /** Match the real rendered width of the box the parent gives this. */
  sizes?: string;
}) {
  // Six of these spots are cut out and two are not, and the mix showed: a
  // floating subject beside a hard-edged rectangle reads as a mistake. A cut-out
  // gets the shadow on its own silhouette; an opaque one gets rounded corners so
  // its edge is a deliberate shape rather than a stray crop.
  const cut = spotIsTransparent(name);
  return (
    <Image
      src={spotSrc(name)}
      alt={alt}
      aria-hidden={alt === "" ? true : undefined}
      fill
      sizes={sizes}
      className={cn(
        "object-contain",
        cut
          ? "drop-shadow-[0_8px_16px_rgba(59,50,42,0.18)]"
          : "rounded-2xl shadow-[0_8px_20px_rgba(59,50,42,0.12)]",
        className,
      )}
    />
  );
}
