import { twMerge } from "tailwind-merge";

/**
 * Join class names, resolving Tailwind conflicts so the last one wins.
 *
 * This used to be a plain join, which meant a className passed to a component
 * did not override that component's own classes — both landed in the attribute
 * and the CSS file's own ordering decided. Tailwind emits utilities in scale
 * order, so `h-11 px-4` from <Button> beat an `h-9 px-0` passed in by a caller,
 * silently, in whichever direction the scale happened to run.
 *
 * That produced a button rendered 36px wide with 32px of padding: four pixels
 * of room for a 16px icon, which looked like an empty button and was reported
 * as one. Seven call sites in this repo were rendering a size other than the
 * one written next to them.
 *
 * twMerge makes the later class win, which is what every caller already
 * assumed was happening.
 */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return twMerge(classes.filter(Boolean).join(" "));
}
