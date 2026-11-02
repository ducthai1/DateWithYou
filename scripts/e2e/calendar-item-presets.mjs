/*
 * Lịch → "Thêm việc": chip việc hay làm, chọn quán là có tên, chi phí có chip.
 *
 * Bấm "Thêm" ở buổi Sáng rồi chọn chip "Ăn tối" — việc phải sang buổi Tối, vì
 * đó là chỗ của nó; chip 200k; lưu → database. Rồi một việc trống tên, chỉ
 * chọn quán trong danh sách: tên việc là tên quán.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Lịch: chip việc hay làm (tự sang đúng buổi), chọn quán → tên việc, chi phí 200k";

const PLACE = "E2E Lịch — Quán bún chả";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The day itself is a dialog; the add form stacks on top of it — read the top one.
const inDialog = `[...document.querySelectorAll('[role="dialog"]')].pop()`;
const btn = (scope, text) => `[...(${scope}?.querySelectorAll("button") ?? [])].find((b) => b.textContent.replace(/\\s+/g, " ").trim() === ${JSON.stringify(text)})`;
const click = (expr) => `(() => { const el = ${expr}; if (!el) return false; el.click(); return true; })()`;
const pad = (n) => String(n).padStart(2, "0");

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 390, height: 844 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });
  const items = db.collection("planitems");
  const locations = db.collection("locations");
  let spaceId = null;

  try {
    await page.viewport(390, 844, true, 2);
    const session = await signIn(page, base, db);
    spaceId = session.spaceId;
    // A day well away from today, so other suites' items for today do not crowd it.
    const d = new Date(Date.now() + 7 * 3600_000 + 40 * 86400_000);
    const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    await items.deleteMany({ spaceId, date: day });
    await locations.deleteMany({ spaceId, name: PLACE });
    await locations.insertOne({ spaceId, name: PLACE, district: "Phường Sài Gòn", category: "Ăn tối", status: "want_to_go", source: "user", createdBy: session.uid, createdAt: new Date(), updatedAt: new Date(), __v: 0 });

    const openAdd = async () => {
      await page.goto(`${base}/calendar?d=${day}`);
      await page.until(`!!document.querySelector('[aria-label="Thêm việc buổi Sáng"]')`, { timeout: 90000 });
      // A click before hydration does nothing (a cold page renders the button
      // well before React owns it), so keep tapping until the form is there.
      return page.until(`(() => {
        if (${inDialog}?.querySelector('[aria-label="Việc hay làm"]')) return true;
        document.querySelector('[aria-label="Thêm việc buổi Sáng"]')?.click();
        return false;
      })()`, { timeout: 30000 }).then(() => true).catch(() => false);
    };

    ok("form Thêm việc có chip việc hay làm", await openAdd());
    await page.eval(click(btn(inDialog, "Ăn tối")));
    await sleep(150);
    ok("bấm \"Ăn tối\" → điền tiêu đề", (await page.eval(`document.querySelector('input[aria-label="Tiêu đề công việc"]').value`)) === "Ăn tối");
    await page.eval(click(btn(inDialog, "200k")));
    await sleep(150);
    ok("chip 200k → 200.000", (await page.eval(`document.querySelector('input[aria-label="Chi phí dự kiến"]').value`)) === "200.000");
    ok("ghi chú gập lại", await page.eval(`!${inDialog}.querySelector("textarea")`));
    if (shotDir) await page.shot(`${shotDir}/calendar-item-presets-390.png`);
    const over = await page.eval(`(() => { const x = ${inDialog}; return x.scrollWidth - x.clientWidth; })()`);
    ok("form không tràn ngang ở 390px", over <= 0, `${over}px`);
    await page.eval(click(`[...${inDialog}.querySelectorAll("button")].find((b) => b.textContent.trim() === "Thêm việc")`));
    let row = null;
    for (let i = 0; i < 40 && !row; i++) { row = await items.findOne({ spaceId, date: day, title: "Ăn tối" }); if (!row) await sleep(250); }
    ok("database: Ăn tối · buổi Tối (dù bấm từ buổi Sáng) · 200.000", !!row && row.bucket === "evening" && row.cost === 200_000, JSON.stringify(row && { bucket: row.bucket, cost: row.cost }));

    // A place, and no name: the place names the item.
    await openAdd();
    await page.eval(`document.querySelector('[aria-label="Địa điểm"]').click()`);
    await sleep(400);
    const picked = await page.eval(click(`[...document.querySelectorAll("button, [role='option']")].find((b) => b.textContent.trim() === ${JSON.stringify(PLACE)})`));
    await sleep(300);
    ok("chọn quán khi chưa có tên → tên việc là tên quán", picked && (await page.eval(`document.querySelector('input[aria-label="Tiêu đề công việc"]').value`)) === PLACE);
  } catch (e) {
    ok("không ném giữa chừng", false, String(e?.message ?? e).slice(0, 200));
  } finally {
    if (spaceId) {
      const d = new Date(Date.now() + 7 * 3600_000 + 40 * 86400_000);
      await items.deleteMany({ spaceId, date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` });
      await locations.deleteMany({ spaceId, name: PLACE });
    }
    page.close();
    chrome.kill();
  }
  return results;
}
