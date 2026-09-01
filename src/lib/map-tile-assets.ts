/**
 * Everything MapLibre fetches from the tile server before it can draw.
 *
 * Listed so they can be warmed ahead of time. The URLs must stay byte-identical
 * to the ones MapLibre builds from the style, or a warm fetch downloads the file
 * a second time instead of filling the cache for it.
 *
 * The three glyph ranges are the ones a Vietnamese viewport uses: 0-255 and
 * 256-511 for Latin (ơ and ư live in the second), and 7680-7935 for the
 * diacritics in Latin Extended Additional.
 */
const HOST = "https://tiles.openfreemap.org";
const GLYPH_RANGES = ["0-255", "256-511", "7680-7935"];
const FONTS = ["Regular", "Italic"];

export function mapTileAssetUrls(devicePixelRatio: number): string[] {
  // MapLibre picks the @2x sprite on any DPR above 1; warming the other one
  // would download 117 KB nothing ever reads.
  const scale = devicePixelRatio > 1 ? "@2x" : "";
  return [
    `${HOST}/styles/liberty`,
    `${HOST}/planet`,
    `${HOST}/sprites/ofm_f384/ofm${scale}.json`,
    `${HOST}/sprites/ofm_f384/ofm${scale}.png`,
    ...FONTS.flatMap((f) =>
      GLYPH_RANGES.map((r) => `${HOST}/fonts/Noto%20Sans%20${f}/${r}.pbf`),
    ),
  ];
}
