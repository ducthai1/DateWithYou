/**
 * Everything MapLibre fetches from the tile server before it can draw.
 *
 * Listed so they can be asked for ahead of time. The URLs must stay
 * byte-identical to the ones MapLibre builds from the style, or an early fetch
 * downloads the file a second time instead of filling the cache for it.
 *
 * The three glyph ranges are the ones a Vietnamese viewport uses: 0-255 and
 * 256-511 for Latin (ơ and ư live in the second), and 7680-7935 for the
 * diacritics in Latin Extended Additional.
 *
 * Split in two, because of WHERE each half can be asked for. The style, the
 * tilejson and the glyphs are the same URLs on every device, so the map route
 * can put them in `<link rel="preload">` in its server-rendered head — before
 * any JavaScript exists. The sprite ships in two resolutions and MapLibre picks
 * by `devicePixelRatio`, which only the browser knows, so that pair has to be
 * requested by a script (see MapAssetPreload).
 */
const HOST = "https://tiles.openfreemap.org";
const GLYPH_RANGES = ["0-255", "256-511", "7680-7935"];
const FONTS = ["Regular", "Italic"];

export const MAP_TILE_HOST = HOST;

/** Style, tilejson and glyphs — identical for every device. */
export function mapDeviceIndependentAssetUrls(): string[] {
  return [
    `${HOST}/styles/liberty`,
    `${HOST}/planet`,
    ...FONTS.flatMap((f) =>
      GLYPH_RANGES.map((r) => `${HOST}/fonts/Noto%20Sans%20${f}/${r}.pbf`),
    ),
  ];
}

/**
 * The sprite pair for one device.
 *
 * MapLibre picks the @2x sprite on any DPR above 1; asking for the other one
 * would download 117 KB nothing ever reads.
 */
export function mapSpriteUrls(devicePixelRatio: number): string[] {
  const scale = devicePixelRatio > 1 ? "@2x" : "";
  return [
    `${HOST}/sprites/ofm_f384/ofm${scale}.json`,
    `${HOST}/sprites/ofm_f384/ofm${scale}.png`,
  ];
}

export function mapTileAssetUrls(devicePixelRatio: number): string[] {
  return [...mapDeviceIndependentAssetUrls(), ...mapSpriteUrls(devicePixelRatio)];
}
