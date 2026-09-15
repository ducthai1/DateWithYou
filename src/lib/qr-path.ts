/**
 * A QR code as one SVG path.
 *
 * `qrcode-generator` can emit SVG itself, and what it emits is one `<rect>`
 * per dark module — 15 KB and about six hundred DOM nodes for a link this
 * length. The same picture is one `<path>` of around 2 KB and a single node,
 * which matters because this is drawn on a phone inside a modal that animates.
 *
 * The library is only asked for the matrix; the drawing happens here, and it
 * happens in a pure function so the geometry can be tested without a browser
 * and without the library.
 *
 * The module grid is turned into path commands rather than one rectangle per
 * module: horizontal runs of dark modules become a single rectangle each, so a
 * solid row costs one command instead of thirty.
 */

/** What this needs from a QR encoder: a size and a dark/light test. */
export type QrMatrix = {
  getModuleCount(): number;
  isDark(row: number, col: number): boolean;
};

export type QrPath = {
  /** The `d` attribute. */
  d: string;
  /** Width and height of the viewBox, in modules including the quiet zone. */
  size: number;
};

/**
 * The quiet zone is part of the spec, not padding.
 *
 * Scanners need four clear modules around the code; without them a phone
 * held close simply never locks on, which reads as "the QR doesn't work".
 */
export const QUIET_ZONE = 4;

export function qrToPath(qr: QrMatrix, quietZone = QUIET_ZONE): QrPath {
  const count = qr.getModuleCount();
  const size = count + quietZone * 2;
  const parts: string[] = [];

  for (let row = 0; row < count; row++) {
    let runStart = -1;
    for (let col = 0; col <= count; col++) {
      const dark = col < count && qr.isDark(row, col);
      if (dark && runStart === -1) {
        runStart = col;
      } else if (!dark && runStart !== -1) {
        // One rectangle for the whole run: M x y h w v 1 h -w z
        const x = runStart + quietZone;
        const y = row + quietZone;
        const w = col - runStart;
        parts.push(`M${x} ${y}h${w}v1h-${w}z`);
        runStart = -1;
      }
    }
  }
  return { d: parts.join(""), size };
}
