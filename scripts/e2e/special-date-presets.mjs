/*
 * Lịch → Ngày đặc biệt: bấm "Valentine" là đủ.
 *
 * Trước đây: tự nghĩ tên, tự chọn ngày, tự chọn biểu tượng, tự nhớ tick "lặp
 * lại". Bộ này bấm chip ngày lễ cố định (Valentine) rồi lưu ngay — đọc
 * database xem đúng ngày 14/02 SẮP TỚI, lặp hằng năm, biểu tượng tim — và chip
 * đã dùng phải biến khỏi hàng; danh sách hiện ngày kiểu dd/MM/yyyy.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Ngày đặc biệt: chip ngày lễ điền đủ tên + ngày sắp tới + lặp năm + biểu tượng, chip đã dùng biến mất";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const form = `document.querySelector("form[data-special-date-form]")`;
const chip = (text) => `[...(${form}?.querySelectorAll('[aria-label="Ngày hay dùng"] button') ?? [])].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const pad = (n) => String(n).padStart(2, "0");

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 390, height: 844 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });
  const special = db.collection("specialdates");
  let spaceId = null;

  try {
    await page.viewport(390, 844, true, 2);
    const session = await signIn(page, base, db);
    spaceId = session.spaceId;
    await special.deleteMany({ spaceId, title: { $in: ["Valentine", "Giáng sinh"] } });

    const vn = new Date(Date.now() + 7 * 3600_000);
    const today = `${vn.getUTCFullYear()}-${pad(vn.getUTCMonth() + 1)}-${pad(vn.getUTCDate())}`;
    const valentine = `${today.slice(0, 4)}-02-14` >= today ? `${today.slice(0, 4)}-02-14` : `${Number(today.slice(0, 4)) + 1}-02-14`;

    await page.goto(`${base}/calendar`);
    await page.until(`!!document.querySelector('[aria-label="Ngày đặc biệt"]')`, { timeout: 90000 });
    await sleep(500);
    await page.eval(`document.querySelector('[aria-label="Ngày đặc biệt"]').click()`);
    ok("hàng \"Hay dùng\" hiện", await page.until(`!!${chip("Valentine")}`, { timeout: 15000 }).then(() => true).catch(() => false));
    if (shotDir) await page.shot(`${shotDir}/special-date-presets-390.png`);

    await page.eval(`${chip("Valentine")}.click()`);
    await sleep(200);
    ok("bấm Valentine → điền tên", (await page.eval(`document.querySelector('input[aria-label="Tên ngày đặc biệt"]').value`)) === "Valentine");
    await page.eval(`${form}.requestSubmit()`);
    let row = null;
    for (let i = 0; i < 40 && !row; i++) { row = await special.findOne({ spaceId, title: "Valentine" }); if (!row) await sleep(250); }
    ok(
      "database: 14/02 sắp tới, lặp hằng năm, biểu tượng tim",
      !!row && row.date === valentine && row.recurYearly === true && row.icon === "heart",
      JSON.stringify(row && { date: row.date, recur: row.recurYearly, icon: row.icon, want: valentine }),
    );
    await page.until(`!${chip("Valentine")}`, { timeout: 10000 }).catch(() => {});
    ok("chip Valentine biến khỏi hàng sau khi thêm", await page.eval(`!${chip("Valentine")}`));
    const label = `${valentine.slice(8, 10)}/${valentine.slice(5, 7)}/${valentine.slice(0, 4)}`;
    ok(`danh sách hiện ngày dạng ${label}`, await page.eval(`document.querySelector('[role="dialog"]').innerText.includes(${JSON.stringify(label)})`));
    const o = await page.eval(`(() => { const d = document.querySelector('[role="dialog"]'); return d.scrollWidth - d.clientWidth; })()`);
    ok("khung không tràn ngang ở 390px", o <= 0, `${o}px`);
  } catch (e) {
    ok("không ném giữa chừng", false, String(e?.message ?? e).slice(0, 200));
  } finally {
    if (spaceId) await special.deleteMany({ spaceId, title: { $in: ["Valentine", "Giáng sinh"] } });
    page.close();
    chrome.kill();
  }
  return results;
}
