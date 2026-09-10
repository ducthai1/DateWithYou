/*
 * The production build, run as a gate, leaving nothing behind.
 *
 * Two things `next build` does that a gate must undo. It writes into the same
 * directory a running `npm run dev` is serving from, which kills the dev
 * server — so this builds into `tmp/vivu-verify` instead (next.config reads
 * NEXT_DIST_DIR). And it rewrites tsconfig.json: it reformats every array and
 * adds an include entry pointing at whatever dist directory was used, which
 * would leave the file dirty after every gate run and eventually get committed
 * with a path to a temporary folder in it.
 *
 * So: remember the file, build, put it back, remove the output. Exits with the
 * build's own status, because that status is the whole point.
 *
 * The output directory is removed here rather than ignored in .gitignore, so
 * nothing is left to commit by accident. If a run is killed mid-build the
 * folder can survive; it is safe to delete by hand.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";

const DIST = "tmp/vivu-verify";
const TSCONFIG = "tsconfig.json";
const before = readFileSync(TSCONFIG, "utf8");

const build = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_DIST_DIR: DIST },
});

const after = readFileSync(TSCONFIG, "utf8");
if (after !== before) {
  writeFileSync(TSCONFIG, before);
  console.log(`\n(đã trả ${TSCONFIG} về nguyên trạng — next build có sửa nó)`);
}
rmSync(DIST, { recursive: true, force: true });

process.exit(build.status ?? 1);
