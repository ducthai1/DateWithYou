/**
 * Rebuild src/lib/brand-cutouts.json by MEASURING the artwork.
 *
 * Whether a picture is cut out decides how it is drawn: a cut-out goes on the
 * page bare with a drop shadow, an opaque one needs a card so it does not float
 * against the backdrop with a hard rectangular edge. That fact used to live in
 * a hand-written list, which went stale the moment new background-removed
 * exports were dropped over the old opaque files — the pictures were cut out
 * and still rendered inside a white card.
 *
 * Run after adding or replacing anything in public/brand-image:
 *   node scripts/measure-brand-cutouts.mjs
 *
 * A cut-out is identified by its BORDER being see-through, not by its overall
 * alpha: a photo-like block with a few soft pixels is not a cut-out, while a
 * subject floating on nothing always has transparent edges.
 */
import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = "public/brand-image";
const OUT = "src/lib/brand-cutouts.json";
const EDGE_TRANSPARENT_PCT = 80; // border pixels that must be see-through

async function isCutout(file) {
  const img = sharp(file).ensureAlpha();
  const { width, height } = await img.metadata();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x, y) => data[(y * info.width + x) * info.channels + 3];

  const edge = [];
  for (let x = 0; x < width; x += 7) edge.push(alphaAt(x, 0), alphaAt(x, height - 1));
  for (let y = 0; y < height; y += 7) edge.push(alphaAt(0, y), alphaAt(width - 1, y));
  const clear = edge.filter((a) => a < 250).length;
  return (clear * 100) / edge.length > EDGE_TRANSPARENT_PCT;
}

const cutouts = [];
for (const dir of (await readdir(ROOT, { withFileTypes: true })).filter((d) => d.isDirectory())) {
  for (const name of (await readdir(join(ROOT, dir.name))).filter((n) => n.endsWith(".png"))) {
    const rel = `${dir.name}/${name}`;
    if (await isCutout(join(ROOT, rel))) cutouts.push(rel);
  }
}
cutouts.sort();
await writeFile(OUT, JSON.stringify(cutouts, null, 2) + "\n");
console.log(`${OUT}: ${cutouts.length} ảnh tách nền`);
for (const c of cutouts) console.log(`  ${c}`);
