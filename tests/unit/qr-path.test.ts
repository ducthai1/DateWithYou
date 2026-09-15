/*
 * Drawing a QR code without six hundred DOM nodes.
 *
 * `qrcode-generator` will emit SVG itself: one `<rect>` per dark module, which
 * for an invite link is 15 KB and hundreds of nodes, on a phone, inside a
 * modal that animates. The same picture is one `<path>` of about 4 KB.
 *
 * The geometry is the part that has to be right — a QR code that is subtly
 * wrong does not look wrong, it just never scans — so it is a pure function
 * tested against hand-built matrices rather than against the library.
 */
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { qrToPath, QUIET_ZONE, type QrMatrix } from "../../src/lib/qr-path.ts";

/**
 * A matrix from a picture: "#" is dark, "." is light.
 *
 * Asserts the picture is SQUARE, because a real QR matrix always is —
 * `getModuleCount()` is both the width and the height. The first draft of
 * these tests used 1x5 fixtures and failed against correct code, which is a
 * fixture that lies rather than a bug found.
 */
function fromRows(rows: string[]): QrMatrix {
  for (const row of rows) {
    if (row.length !== rows.length) {
      throw new Error(`fixture is ${rows.length} rows but ${row.length} wide — QR matrices are square`);
    }
  }
  return {
    getModuleCount: () => rows.length,
    isDark: (r, c) => rows[r][c] === "#",
  };
}

describe("the geometry", () => {
  test("a single dark module is one square, offset by the quiet zone", () => {
    const qr = fromRows([".....", ".....", "..#..", ".....", "....."]);
    const { d, size } = qrToPath(qr, 4);
    assert.equal(size, 5 + 8, "the quiet zone is added on both sides");
    assert.equal(d, "M6 6h1v1h-1z", "row 2, col 2 becomes x=6, y=6");
  });

  test("a run of dark modules is ONE rectangle, not one per module", () => {
    // The whole point: a solid row costs one command instead of thirty.
    const qr = fromRows(["....", "####", "....", "...."]);
    const { d } = qrToPath(qr, 0);
    assert.equal(d, "M0 1h4v1h-4z");
    assert.equal((d.match(/M/g) ?? []).length, 1);
  });

  test("two runs in one row stay two rectangles", () => {
    const qr = fromRows(["##.##", ".....", ".....", ".....", "....."]);
    const { d } = qrToPath(qr, 0);
    assert.equal(d, "M0 0h2v1h-2zM3 0h2v1h-2z");
  });

  test("a run that reaches the last column is closed", () => {
    /*
     * The loop runs one past the end on purpose. Without that, a dark module
     * in the final column never gets its rectangle emitted — and the right
     * edge of a QR code carries the timing pattern, so the damage is invisible
     * and total.
     */
    const qr = fromRows(["..##", "....", "....", "...."]);
    const { d } = qrToPath(qr, 0);
    assert.equal(d, "M2 0h2v1h-2z");
  });

  test("an all-dark grid is one rectangle per row", () => {
    const qr = fromRows(["###", "###", "###"]);
    const { d } = qrToPath(qr, 0);
    assert.equal((d.match(/M/g) ?? []).length, 3);
  });

  test("an empty grid draws nothing at all", () => {
    const qr = fromRows(["...", "...", "..."]);
    assert.equal(qrToPath(qr, 0).d, "");
  });
});

describe("the quiet zone", () => {
  test("it defaults to the four modules the spec asks for", () => {
    // Not padding: a scanner needs four clear modules or a phone held close
    // never locks on, which reads as "the QR doesn't work".
    assert.equal(QUIET_ZONE, 4);
    const qr = fromRows(["#"]);
    assert.equal(qrToPath(qr).size, 1 + 8);
    assert.equal(qrToPath(qr).d, "M4 4h1v1h-1z");
  });

  test("it can be turned off for a caller that adds its own", () => {
    const qr = fromRows(["#"]);
    assert.equal(qrToPath(qr, 0).size, 1);
  });
});

describe("against the real encoder", () => {
  test("it draws the same modules the library would", async () => {
    /*
     * The library is the source of truth for WHICH modules are dark; this file
     * only decides how to draw them. So the check is that every dark module in
     * the real matrix is covered by some rectangle, and no light one is.
     */
    const { default: qrcode } = await import("qrcode-generator");
    const q = qrcode(0, "M");
    q.addData("https://vivu-noplan.vercel.app/moi/ABCD234XYZ");
    q.make();

    const { d, size } = qrToPath(q, 0);
    assert.equal(size, q.getModuleCount());

    // Replay the path back into a grid and compare it to the matrix.
    const n = q.getModuleCount();
    const grid = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
    for (const m of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
      const x = Number(m[1]);
      const y = Number(m[2]);
      const w = Number(m[3]);
      for (let i = 0; i < w; i++) grid[y][x + i] = true;
    }
    let dark = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        assert.equal(grid[r][c], q.isDark(r, c), `module ${r},${c} disagrees`);
        if (q.isDark(r, c)) dark++;
      }
    }
    assert.ok(dark > 100, "a real code has plenty of dark modules");
  });

  test("it is far smaller than the library's own SVG", async () => {
    const { default: qrcode } = await import("qrcode-generator");
    const q = qrcode(0, "M");
    q.addData("https://vivu-noplan.vercel.app/moi/ABCD234XYZ");
    q.make();
    const theirs = q.createSvgTag({ cellSize: 4, margin: 4 }).length;
    const ours = qrToPath(q).d.length;
    assert.ok(ours < theirs / 2, `${ours} vs ${theirs} is not the saving this exists for`);
  });
});
