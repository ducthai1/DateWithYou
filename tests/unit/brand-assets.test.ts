import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/*
 * The art registry must describe files that are really there.
 *
 * `src/lib/tone.ts` names every illustration by filename, extension included,
 * and nothing at build time checks those names against the folder — a renamed
 * or re-encoded asset just 404s at runtime, on whichever screen happens to use
 * it. That is exactly what a format change does: the PNGs became WebP, then
 * AVIF, and each time the registry had to be rewritten by hand.
 *
 * Deliberately reads the file as text instead of importing it. `tone.ts`
 * imports a JSON module, which Node will not load without an import attribute,
 * and the point here is the string in the registry rather than the value the
 * bundler ends up with.
 */

const ROOT = new URL("../../", import.meta.url).pathname;
const ART_DIR = join(ROOT, "public/brand-image");
const TONE_TS = readFileSync(join(ROOT, "src/lib/tone.ts"), "utf8");

/** The body of a top-level `const NAME = { ... };` object in tone.ts. */
function block(name: string): string {
  const start = TONE_TS.indexOf(`const ${name}`);
  assert.notEqual(start, -1, `không tìm thấy ${name} trong tone.ts`);
  const end = TONE_TS.indexOf("\n};", start);
  assert.notEqual(end, -1, `không tìm thấy điểm kết thúc của ${name}`);
  return TONE_TS.slice(start, end);
}

test("ART: mỗi ảnh trong registry phải có thật ở đúng thư mục tông của nó", () => {
  const art = block("ART");
  const entries = [...art.matchAll(/(\w+):\s*\{\s*file:\s*"([^"]+)",\s*tones:\s*(\w+)/g)];
  assert.ok(entries.length >= 15, `chỉ đọc được ${entries.length} mục ART — regex có thể đã lệch`);
  for (const [, key, file, tones] of entries) {
    const folders = tones === "ONLY_MORNING" ? ["morning-tone"] : ["morning-tone", "afternoon-tone"];
    for (const f of folders) {
      assert.ok(existsSync(join(ART_DIR, f, file)), `ART.${key} trỏ tới ${f}/${file} nhưng không có tệp đó`);
    }
  }
});

test("SPOT: mỗi ảnh lẻ phải có thật trong common-page", () => {
  const spot = block("SPOT");
  const entries = [...spot.matchAll(/(\w+):\s*"([^"]+\.\w+)"/g)];
  assert.ok(entries.length >= 5, `chỉ đọc được ${entries.length} mục SPOT`);
  for (const [, key, file] of entries) {
    assert.ok(existsSync(join(ART_DIR, "common-page", file)), `SPOT.${key} trỏ tới common-page/${file} nhưng không có tệp đó`);
  }
});

test("logo-icon: đuôi tệp trong code khớp với đuôi tệp trên đĩa", () => {
  const m = TONE_TS.match(/\/brand-image\/logo-icon\/\$\{file\}\.(\w+)`/);
  assert.ok(m, "không tìm thấy chỗ dựng đường dẫn logo-icon");
  const ext = m![1];
  const onDisk = readdirSync(join(ART_DIR, "logo-icon"));
  assert.ok(onDisk.length > 0, "thư mục logo-icon rỗng");
  for (const f of onDisk) {
    assert.ok(f.endsWith(`.${ext}`), `code dùng .${ext} nhưng trên đĩa có ${f}`);
  }
  const wordmark = TONE_TS.match(/"(\/brand-image\/logo-icon\/[^"]+)"/);
  assert.ok(wordmark, "không tìm thấy đường dẫn wordmark cố định");
  assert.ok(existsSync(join(ROOT, "public", wordmark![1])), `${wordmark![1]} không có trên đĩa`);
});

test("brand-cutouts.json: mọi ảnh tách nền được liệt kê đều có thật", () => {
  const list: string[] = JSON.parse(readFileSync(join(ROOT, "src/lib/brand-cutouts.json"), "utf8"));
  assert.ok(list.length > 0, "danh sách ảnh tách nền rỗng — script đo có thể đã lọc sai đuôi tệp");
  for (const rel of list) {
    assert.ok(existsSync(join(ART_DIR, rel)), `brand-cutouts liệt kê ${rel} nhưng không có tệp đó`);
  }
});

test("Cả thư mục brand-image dùng chung một đuôi tệp", () => {
  const exts = new Set<string>();
  for (const dir of readdirSync(ART_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const f of readdirSync(join(ART_DIR, dir.name))) exts.add(f.split(".").pop()!);
  }
  assert.equal(exts.size, 1, `trộn nhiều định dạng: ${[...exts].join(", ")} — registry sẽ khó theo kịp`);
});
