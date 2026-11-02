/*
 * Sổ tay → "Sổ mới" từ mẫu.
 *
 * Trước đây: tự đặt tên, tự gõ "Trưa, Tối" bằng dấu phẩy, tự tính ngày kết
 * thúc. Bộ này bấm mẫu "Siết cân" (tên + 4 cột + 30 ngày), đổi sang "2 tuần",
 * tạo sổ — đọc database: đúng tên, đúng cột, đúng 14 ngày.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Sổ tay: Sổ mới từ mẫu (tên + cột + số ngày), chip 2 tuần — đúng ở database";

const TITLE = "Siết cân";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const inDialog = `[...document.querySelectorAll('[role="dialog"]')].pop()`;
const btn = (text) => `[...(${inDialog}?.querySelectorAll("button") ?? [])].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const pressed = (text) => `(${btn(text)})?.getAttribute("aria-pressed") === "true"`;
const click = (expr) => `(() => { const el = ${expr}; if (!el) return false; el.click(); return true; })()`;

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 390, height: 844 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });
  const notebooks = db.collection("notebooks");
  let spaceId = null;

  try {
    await page.viewport(390, 844, true, 2);
    const session = await signIn(page, base, db);
    spaceId = session.spaceId;
    await notebooks.deleteMany({ spaceId, title: TITLE });

    await page.goto(`${base}/so-tay`);
    // Either the empty state's button or the toolbar's "Sổ mới"; tap until the form is up (hydration).
    const opened = await page.until(`(() => {
      if (${inDialog}?.querySelector('[aria-label="Mẫu sổ"]')) return true;
      [...document.querySelectorAll("button")].find((b) => /Sổ mới|Tạo sổ đầu tiên/.test(b.textContent))?.click();
      return false;
    })()`, { timeout: 90000 }).then(() => true).catch(() => false);
    ok("form Sổ mới có hàng mẫu", opened);

    await page.eval(click(btn("Siết cân")));
    await sleep(200);
    const title = await page.eval(`${inDialog}.querySelector("input").value`);
    const cols = await page.eval(`[...${inDialog}.querySelectorAll("input")].map((i) => i.value).find((v) => v.includes(","))`);
    ok("mẫu Siết cân → tên + 4 cột", title === TITLE && cols === "Trưa 12h, Bữa phụ 17h30, Tối 19h30, Tập", JSON.stringify({ title, cols }));
    ok("…và 1 tháng", await page.eval(pressed("1 tháng")));
    await page.eval(click(btn("2 tuần")));
    await sleep(200);
    ok("chip 2 tuần → 14 ngày × 4 cột", await page.eval(`${inDialog}.innerText.includes("14 ngày × 4 cột")`));
    if (shotDir) await page.shot(`${shotDir}/notebook-templates-390.png`);
    const over = await page.eval(`(() => { const d = ${inDialog}; return d.scrollWidth - d.clientWidth; })()`);
    ok("form không tràn ngang ở 390px", over <= 0, `${over}px`);

    await page.eval(`${inDialog}.querySelector("form").requestSubmit()`);
    let nb = null;
    for (let i = 0; i < 40 && !nb; i++) { nb = await notebooks.findOne({ spaceId, title: TITLE }); if (!nb) await sleep(250); }
    ok(
      "database: Siết cân · 4 cột · 14 ngày",
      !!nb && nb.slots.map((s) => s.label).join(", ") === "Trưa 12h, Bữa phụ 17h30, Tối 19h30, Tập" && nb.days.length === 14,
      JSON.stringify(nb && { slots: nb.slots.length, days: nb.days.length }),
    );
  } catch (e) {
    ok("không ném giữa chừng", false, String(e?.message ?? e).slice(0, 200));
  } finally {
    if (spaceId) await notebooks.deleteMany({ spaceId, title: TITLE });
    page.close();
    chrome.kill();
  }
  return results;
}
