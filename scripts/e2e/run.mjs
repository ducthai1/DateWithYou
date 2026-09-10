/*
 * The browser suites, run against a dev server you already have running.
 *
 * Why this lives in the repo rather than in a scratch folder: every check in
 * here was written once to prove a fix, then thrown away, then written again
 * from memory the next time something in the same area broke. Kept here they
 * are re-runnable by anyone, and they say out loud what "it works" means.
 *
 * Uses the Chrome already on the machine over the DevTools protocol — no
 * Playwright, no browser download, nothing added to the app's dependencies.
 *
 *   npm run e2e            # tất cả
 *   npm run e2e -- images  # chỉ một bộ
 *
 * Trước khi chạy: `npm run dev`. Và nếu vừa đổi tệp trong public/, hãy khởi
 * động lại dev — nó phục vụ ảnh tối ưu từ cache, nên phép kiểm có thể đi qua
 * ảnh cũ mà tưởng là đạt.
 */
import mongoose from "mongoose";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.E2E_BASE ?? "http://localhost:4488";
const DB_NAME = process.env.E2E_DB ?? "DateWithYou_Local";
const SHOT_DIR = join(tmpdir(), "vivu-e2e");

const SUITES = [
  { id: "images", load: () => import("./images.mjs") },
  { id: "watch", load: () => import("./watch.mjs") },
  { id: "listen", load: () => import("./listen-together.mjs") },
  { id: "calendar", load: () => import("./calendar.mjs") },
];

/** Never point the suites at anything that could be production data. */
function assertLocalDatabase(name) {
  if (/prod|production/i.test(name)) {
    throw new Error(`E2E từ chối chạy trên database tên "${name}" — nghe như production`);
  }
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  assertLocalDatabase(DB_NAME);

  const res = await fetch(`${BASE}/sign-in`).catch(() => null);
  if (!res || !res.ok) {
    console.error(`Không thấy dev server ở ${BASE}. Chạy \`npm run dev\` trước đã.`);
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error("Thiếu MONGODB_URI. Chạy qua `npm run e2e` để nó nạp .env.");
    process.exit(1);
  }

  mkdirSync(SHOT_DIR, { recursive: true });
  await mongoose.connect(process.env.MONGODB_URI, { dbName: DB_NAME, serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db;

  let port = 9431;
  let pass = 0, fail = 0;
  try {
    for (const suite of SUITES) {
      if (only.length && !only.includes(suite.id)) continue;
      const mod = await suite.load();
      console.log(`\n── ${mod.name}`);
      const results = await mod.run({
        base: BASE, db, shotDir: SHOT_DIR,
        port: port++, profileDir: join(SHOT_DIR, `chrome-${suite.id}`),
      });
      for (const r of results) {
        console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? " — " + r.detail : ""}`);
        if (r.ok) pass++;
        else fail++;
      }
    }
  } finally {
    await mongoose.disconnect();
  }
  console.log(`\n${pass}/${pass + fail} đạt${fail ? "" : " — ảnh chụp ở " + SHOT_DIR}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error("E2E hỏng:", e); process.exit(1); });
