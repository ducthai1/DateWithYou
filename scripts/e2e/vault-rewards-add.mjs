/*
 * Phiếu bé ngoan: thêm nhiệm vụ / voucher bằng gợi ý và chip điểm.
 *
 * Trước đây là ô tên + ô số trần + "+". Bộ này bấm một gợi ý (điền cả tên lẫn
 * điểm), thêm, xem gợi ý đó biến khỏi hàng; gõ tên riêng rồi chọn chip điểm;
 * dùng "Số khác"; thêm một voucher từ gợi ý — và đọc database từng lần.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Phiếu bé ngoan: gợi ý bấm-là-điền (tên + điểm), chip điểm, Số khác, gợi ý đã dùng thì biến mất";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const form = (what) => `document.querySelector('form[data-reward-add="${what}"]')`;
const chipIn = (what, text) => `[...(${form(what)}?.querySelectorAll("button[aria-pressed]") ?? [])].find((b) => b.textContent.replace(/\\s+/g, " ").trim().startsWith(${JSON.stringify(text)}))`;
const click = (expr) => `(() => { const el = ${expr}; if (!el) return false; el.click(); return true; })()`;
const setField = (sel, value) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return false;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
})()`;

async function settles(check, timeout = 10000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await check()) return true;
    await sleep(200);
  }
  return false;
}

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 390, height: 844 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });
  const tasks = db.collection("rewardtasks");
  const vouchers = db.collection("rewardvouchers");
  let spaceId = null;

  try {
    await page.viewport(390, 844, true, 2);
    const session = await signIn(page, base, db);
    spaceId = session.spaceId;
    // The test space's own reward lists: start them empty so "already on the list" is this run's doing.
    await tasks.deleteMany({ spaceId });
    await vouchers.deleteMany({ spaceId });

    await page.goto(`${base}/vault?tab=rewards`);
    const shown = await page.until(`!!${form("nhiệm vụ")} && !!${chipIn("nhiệm vụ", "Rửa bát")}`, { timeout: 90000 }).then(() => true).catch(() => false);
    ok("hàng gợi ý nhiệm vụ hiện", shown);
    if (shotDir) await page.shot(`${shotDir}/vault-rewards-add-390.png`);

    // 1. A suggestion fills name and points; "Thêm" adds it.
    await page.eval(click(chipIn("nhiệm vụ", "Rửa bát")));
    await sleep(150);
    ok("bấm gợi ý \"Rửa bát · 10đ\" → điền tên", (await page.eval(`document.querySelector('input[aria-label="Tên nhiệm vụ"]').value`)) === "Rửa bát");
    ok("…và chọn 10đ", await page.eval(`${chipIn("nhiệm vụ", "10đ")}?.getAttribute("aria-pressed") === "true"`));
    await page.eval(`${form("nhiệm vụ")}.requestSubmit()`);
    ok("database: Rửa bát · 10 điểm", await settles(async () => (await tasks.findOne({ spaceId, title: "Rửa bát" }))?.points === 10));
    await page.until(`!${chipIn("nhiệm vụ", "Rửa bát")}`, { timeout: 10000 }).catch(() => {});
    ok("gợi ý đã thêm thì biến khỏi hàng", await page.eval(`!${chipIn("nhiệm vụ", "Rửa bát")}`));
    ok("ô tên trống lại sau khi thêm", (await page.eval(`document.querySelector('input[aria-label="Tên nhiệm vụ"]').value`)) === "");

    // 2. Their own name, a point chip.
    await page.eval(setField('input[aria-label="Tên nhiệm vụ"]', "Lau kính cửa sổ"));
    await page.eval(click(chipIn("nhiệm vụ", "20đ")));
    await page.eval(`${form("nhiệm vụ")}.requestSubmit()`);
    ok("database: tên tự gõ + chip 20đ", await settles(async () => (await tasks.findOne({ spaceId, title: "Lau kính cửa sổ" }))?.points === 20));

    // 3. "Số khác" for a number the chips do not have.
    await page.eval(setField('input[aria-label="Tên nhiệm vụ"]', "Sửa xe"));
    await page.eval(click(chipIn("nhiệm vụ", "Số khác")));
    await page.until(`!!document.querySelector('input[aria-label="Số điểm khác của nhiệm vụ"]')`, { timeout: 5000 }).catch(() => {});
    await page.eval(setField('input[aria-label="Số điểm khác của nhiệm vụ"]', "35"));
    await page.eval(`${form("nhiệm vụ")}.requestSubmit()`);
    ok("database: Số khác = 35 điểm", await settles(async () => (await tasks.findOne({ spaceId, title: "Sửa xe" }))?.points === 35));

    // 4. A voucher from its own ideas.
    await page.eval(click(chipIn("voucher", "Được chọn phim tối nay")));
    await sleep(150);
    await page.eval(`${form("voucher")}.requestSubmit()`);
    ok("database: voucher \"Được chọn phim tối nay\" · 30 điểm", await settles(async () => (await vouchers.findOne({ spaceId, title: "Được chọn phim tối nay" }))?.cost === 30));

    // The page's own scroller and the document — the tab strip and the ideas row scroll sideways on purpose.
    const o = JSON.parse(await page.eval(`(() => {
      const page = [...document.querySelectorAll("div")].filter((d) => {
        const s = getComputedStyle(d);
        return s.overflowY === "auto" && s.overflowX === "hidden" && d.querySelector("form[data-reward-add]");
      }).pop();
      const doc = document.documentElement;
      // Name the widest thing past the edge that is not inside a strip meant to scroll.
      const edge = page ? page.getBoundingClientRect().right : innerWidth;
      const inStrip = (el) => { for (let p = el.parentElement; p && p !== page; p = p.parentElement) if (getComputedStyle(p).overflowX === "auto") return true; return false; };
      const worst = page && [...page.querySelectorAll("*")].filter((el) => el.getBoundingClientRect().right > edge + 1 && !inStrip(el))
        .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0];
      return JSON.stringify({
        page: page ? page.scrollWidth - page.clientWidth : -1, doc: doc.scrollWidth - doc.clientWidth,
        worst: worst ? worst.tagName.toLowerCase() + " ." + String(worst.className).slice(0, 80) + " «" + worst.textContent.slice(0, 40) + "»" : null,
      });
    })()`));
    ok("không tràn ngang ở 390px", o.page === 0 && o.doc === 0, JSON.stringify(o));
    await page.eval(`${form("nhiệm vụ")}.scrollIntoView({ block: "center" })`);
    await sleep(400);
    if (shotDir) await page.shot(`${shotDir}/vault-rewards-add-390-after.png`);
  } catch (e) {
    ok("không ném giữa chừng", false, String(e?.message ?? e).slice(0, 200));
  } finally {
    if (spaceId) {
      await tasks.deleteMany({ spaceId });
      await vouchers.deleteMany({ spaceId });
    }
    page.close();
    chrome.kill();
  }
  return results;
}
