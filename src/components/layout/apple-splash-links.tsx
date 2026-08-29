/**
 * iOS launch images.
 *
 * Android gets a splash for free: Chrome builds one from the manifest's name,
 * background_color and 512px icon. Safari ignores the manifest for this
 * entirely — the ONLY way an installed web app shows anything before its first
 * paint on iOS is a <link rel="apple-touch-startup-image"> whose media query
 * matches that exact device, which is why the app opened straight onto the
 * landing page there while Android showed an intro.
 *
 * The match is on the LOGICAL size plus the pixel ratio; the file has to be the
 * PHYSICAL size, and a mismatch is silently ignored rather than scaled. Hence
 * one file per device class instead of a handful of sizes.
 *
 * Portrait everywhere, landscape on tablets only: a phone app is launched
 * upright, and an unused landscape file is a download nobody needs.
 *
 * Regenerate the images and this table together — they are one list, and a file
 * that exists without its query, or a query without its file, both show
 * nothing at all.
 */

type Splash = { w: number; h: number; dpr: number; orient: "portrait" | "landscape"; file: string };

const SPLASH: Splash[] = [
  { w: 440, h: 956, dpr: 3, orient: "portrait", file: "440x956-3x-portrait.png" }, // iPhone 16 Pro Max
  { w: 402, h: 874, dpr: 3, orient: "portrait", file: "402x874-3x-portrait.png" }, // iPhone 16 Pro
  { w: 430, h: 932, dpr: 3, orient: "portrait", file: "430x932-3x-portrait.png" }, // iPhone 15/14 Pro Max
  { w: 393, h: 852, dpr: 3, orient: "portrait", file: "393x852-3x-portrait.png" }, // iPhone 16/15/14 Pro
  { w: 428, h: 926, dpr: 3, orient: "portrait", file: "428x926-3x-portrait.png" }, // iPhone 14 Plus, 13/12 Pro Max
  { w: 390, h: 844, dpr: 3, orient: "portrait", file: "390x844-3x-portrait.png" }, // iPhone 16e/15/14/13/12
  { w: 375, h: 812, dpr: 3, orient: "portrait", file: "375x812-3x-portrait.png" }, // iPhone 13/12 mini, 11 Pro, X/XS
  { w: 414, h: 896, dpr: 3, orient: "portrait", file: "414x896-3x-portrait.png" }, // iPhone 11 Pro Max, XS Max
  { w: 414, h: 896, dpr: 2, orient: "portrait", file: "414x896-2x-portrait.png" }, // iPhone 11, XR
  { w: 414, h: 736, dpr: 3, orient: "portrait", file: "414x736-3x-portrait.png" }, // iPhone 8/7/6s Plus
  { w: 375, h: 667, dpr: 2, orient: "portrait", file: "375x667-2x-portrait.png" }, // iPhone SE 2/3, 8/7/6s
  { w: 320, h: 568, dpr: 2, orient: "portrait", file: "320x568-2x-portrait.png" }, // iPhone SE 1st gen
  { w: 1024, h: 1366, dpr: 2, orient: "portrait", file: "1024x1366-2x-portrait.png" }, // iPad Pro 12.9
  { w: 1024, h: 1366, dpr: 2, orient: "landscape", file: "1024x1366-2x-landscape.png" }, // iPad Pro 12.9
  { w: 834, h: 1194, dpr: 2, orient: "portrait", file: "834x1194-2x-portrait.png" }, // iPad Pro 11
  { w: 834, h: 1194, dpr: 2, orient: "landscape", file: "834x1194-2x-landscape.png" }, // iPad Pro 11
  { w: 820, h: 1180, dpr: 2, orient: "portrait", file: "820x1180-2x-portrait.png" }, // iPad Air
  { w: 820, h: 1180, dpr: 2, orient: "landscape", file: "820x1180-2x-landscape.png" }, // iPad Air
  { w: 810, h: 1080, dpr: 2, orient: "portrait", file: "810x1080-2x-portrait.png" }, // iPad 10.2
  { w: 810, h: 1080, dpr: 2, orient: "landscape", file: "810x1080-2x-landscape.png" }, // iPad 10.2
  { w: 768, h: 1024, dpr: 2, orient: "portrait", file: "768x1024-2x-portrait.png" }, // iPad mini/9.7
  { w: 768, h: 1024, dpr: 2, orient: "landscape", file: "768x1024-2x-landscape.png" }, // iPad mini/9.7
  { w: 744, h: 1133, dpr: 2, orient: "portrait", file: "744x1133-2x-portrait.png" }, // iPad mini 6
  { w: 744, h: 1133, dpr: 2, orient: "landscape", file: "744x1133-2x-landscape.png" }, // iPad mini 6
];

export function AppleSplashLinks() {
  return (
    <>
      {SPLASH.map((s) => (
        <link
          key={s.file}
          rel="apple-touch-startup-image"
          href={`/splash/${s.file}`}
          media={`screen and (device-width: ${s.w}px) and (device-height: ${s.h}px) and (-webkit-device-pixel-ratio: ${s.dpr}) and (orientation: ${s.orient})`}
        />
      ))}
    </>
  );
}
