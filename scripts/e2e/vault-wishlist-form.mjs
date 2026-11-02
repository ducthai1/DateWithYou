/*
 * "Thêm vào Wishlist" — dán link, bấm giá, chọn điểm.
 *
 * Form cũ: giá gõ trần "500000", điểm đổi quà là một con số không ai có cảm
 * giác, link bắt gõ "https://". Bộ này dán link Shopee vào ô TÊN (như người
 * dùng hay làm), chọn giá bằng chip rồi gõ đè, chọn điểm và đọc dòng "≈ N
 * nhiệm vụ" theo nhiệm vụ thật của cặp đôi, Backspace đè đúng dấu chấm — rồi
 * sửa lại để xoá giá và link, và đọc database ở mỗi bước.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Wishlist (/vault): dán link vào ô tên, giá có dấu chấm + chip, điểm theo nhiệm vụ thật, xoá giá/link khi sửa";

const LINK = "https://shopee.vn/Gi%C3%A0y-Sneaker-Nam-Tr%E1%BA%AFng-i.88201679.2185432011";
const NAME = "Giày Sneaker Nam Trắng";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const inDialog = `document.querySelector('[role="dialog"]')`;
const chip = (text) => `[...(${inDialog}?.querySelectorAll("button[aria-pressed]") ?? [])].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const pressed = (text) => `(${chip(text)})?.getAttribute("aria-pressed") === "true"`;
const click = (expr) => `(() => { const el = ${expr}; if (!el) return false; el.click(); return true; })()`;
const clickButton = (text, scope = "document") =>
  `(() => { const b = [...${scope}.querySelectorAll("button")].find((x) => x.textContent.trim().includes(${JSON.stringify(text)}) && !x.disabled); if (!b) return false; b.click(); return true; })()`;
const setField = (sel, value) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return false;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
})()`;
const value = (sel) => `document.querySelector(${JSON.stringify(sel)})?.value ?? null`;
const PRICE = `[role="dialog"] input[aria-label="Giá dự kiến"]`;
const dialogGone = `!document.querySelector('[role="dialog"]')`;
const footerReachable = `(() => {
  const d = ${inDialog}; const b = d && [...d.querySelectorAll("button[type=submit]")].pop();
  if (!b) return false;
  const r = b.getBoundingClientRect(), box = d.getBoundingClientRect();
  return r.height > 0 && r.bottom <= box.bottom + 1 && r.bottom <= innerHeight;
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
  const wishes = db.collection("wishlistitems");
  let spaceId = null;

  try {
    await page.viewport(390, 844, true, 2);
    const session = await signIn(page, base, db);
    spaceId = session.spaceId;
    await wishes.deleteMany({ spaceId });
    await db.collection("rewardtasks").deleteMany({ spaceId, title: { $regex: "^E2E wish" } });
    // Their tasks are worth 20 each, so 100 points reads as five of them.
    await db.collection("rewardtasks").insertMany([
      { spaceId, title: "E2E wish — rửa bát", points: 20, createdAt: new Date(), updatedAt: new Date(), __v: 0 },
      { spaceId, title: "E2E wish — đấm lưng", points: 20, createdAt: new Date(), updatedAt: new Date(), __v: 0 },
    ]);
    // Any other tasks in the test space would move the average; this run needs exactly these.
    const otherTasks = await db.collection("rewardtasks").countDocuments({ spaceId, title: { $not: /^E2E wish/ } });

    await page.goto(`${base}/vault?tab=wishlist`);
    await page.until(`[...document.querySelectorAll("button")].some((b) => b.textContent.includes("Thêm món quà"))`, { timeout: 90000 });
    await sleep(500);
    await page.eval(clickButton("Thêm món quà"));
    ok("form mở được", await page.until(`!!document.querySelector("#wish-name")`, { timeout: 10000 }).then(() => true).catch(() => false));
    await sleep(400);
    ok("nút lưu nằm trong khung ở 390px", await page.eval(footerReachable));

    // 1. A Shopee link pasted where the name goes.
    await page.eval(setField("#wish-name", LINK));
    await sleep(200);
    ok("dán link vào ô tên: tên lấy từ link", (await page.eval(value("#wish-name"))) === NAME, String(await page.eval(value("#wish-name"))));
    ok("…link chuyển xuống ô Link", (await page.eval(value("#wish-link"))) === LINK);
    ok("…và có dòng báo đã chuyển", await page.eval(`!!${inDialog}.querySelector('[role="status"]')?.textContent.includes("lấy tên từ link")`));

    // 2. Price: a chip, then typed over, with dots drawn as it goes.
    await page.eval(click(chip("500k")));
    await sleep(150);
    ok("chip 500k → 500.000", (await page.eval(value(PRICE))) === "500.000");
    await page.eval(setField(PRICE, "1250000"));
    await sleep(150);
    ok("gõ 1250000 → hiện 1.250.000", (await page.eval(value(PRICE))) === "1.250.000");
    // Backspace with the caret just after the first dot: the "1" goes, not nothing.
    await page.eval(`(() => { const el = document.querySelector(${JSON.stringify(PRICE)}); el.focus(); el.setSelectionRange(2, 2); })()`);
    await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 });
    await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 });
    await sleep(150);
    ok("Backspace đè dấu chấm xoá chữ số trước nó", (await page.eval(value(PRICE))) === "250.000", String(await page.eval(value(PRICE))));
    await page.eval(setField(PRICE, "1250000"));

    // 3. Points, read against their own tasks.
    ok("mặc định không đổi bằng điểm", await page.eval(pressed("Không")));
    await page.eval(click(chip("100 điểm")));
    await sleep(150);
    const hint = await page.eval(`${inDialog}.querySelector("[data-wish-points-hint]")?.textContent ?? ""`);
    ok("100 điểm ≈ 5 nhiệm vụ 20 điểm (nhiệm vụ thật của hai bạn)", otherTasks > 0 || hint.includes("≈ 5 nhiệm vụ 20 điểm"), hint);
    ok("ghi chú gập lại", await page.eval(`!document.querySelector("#wish-note")`));
    if (shotDir) await page.shot(`${shotDir}/vault-wish-form-390.png`);
    const over = await page.eval(`(() => { const d = ${inDialog}; return d.scrollWidth - d.clientWidth; })()`);
    ok("form không tràn ngang ở 390px", over <= 0, `${over}px`);

    await page.eval(`${inDialog}.querySelector("form[data-wish-form]").requestSubmit()`);
    await page.until(dialogGone, { timeout: 15000 }).catch(() => {});
    const saved = await settles(async () => !!(await wishes.findOne({ spaceId, itemName: NAME })));
    const row = await wishes.findOne({ spaceId, itemName: NAME });
    ok(
      "database: tên, giá 1.250.000, 100 điểm, link, tặng người kia",
      saved && row.price === 1250000 && row.pointCost === 100 && row.sourceUrl === LINK && row.forWhom === "partner",
      JSON.stringify(row && { price: row.price, pointCost: row.pointCost, forWhom: row.forWhom }),
    );

    // 4. Editing takes the price and the link away again.
    await page.until(`[...document.querySelectorAll("h4")].some((h) => h.textContent.trim() === ${JSON.stringify(NAME)})`, { timeout: 10000 }).catch(() => {});
    await page.eval(click(`[...document.querySelectorAll("h4")].find((h) => h.textContent.trim() === ${JSON.stringify(NAME)})`));
    await page.until(`!!document.querySelector("#wish-name")`, { timeout: 10000 }).catch(() => {});
    ok("sửa: giá hiện 1.250.000", (await page.eval(value(PRICE))) === "1.250.000");
    ok("sửa: 100 điểm đang chọn", await page.eval(pressed("100 điểm")));
    await page.eval(setField(PRICE, ""));
    await page.eval(setField("#wish-link", ""));
    await page.eval(`${inDialog}.querySelector("form[data-wish-form]").requestSubmit()`);
    await page.until(dialogGone, { timeout: 15000 }).catch(() => {});
    ok("database: xoá giá và link khi sửa", await settles(async () => {
      const r = await wishes.findOne({ spaceId, itemName: NAME });
      return r && r.price == null && r.sourceUrl == null && r.pointCost === 100;
    }));

    // 5. The same form on a desktop.
    await page.viewport(1440, 900, false, 1);
    await page.goto(`${base}/vault?tab=wishlist`);
    await page.until(`[...document.querySelectorAll("button")].some((b) => b.textContent.includes("Thêm món quà"))`, { timeout: 60000 });
    await sleep(500);
    await page.eval(clickButton("Thêm món quà"));
    await page.until(`!!document.querySelector("#wish-name")`, { timeout: 10000 }).catch(() => {});
    await sleep(400);
    ok("nút lưu nằm trong khung ở 1440px", await page.eval(footerReachable));
    if (shotDir) await page.shot(`${shotDir}/vault-wish-form-1440.png`);
  } catch (e) {
    ok("không ném giữa chừng", false, String(e?.message ?? e).slice(0, 200));
  } finally {
    if (spaceId) {
      await wishes.deleteMany({ spaceId });
      await db.collection("rewardtasks").deleteMany({ spaceId, title: { $regex: "^E2E wish" } });
    }
    page.close();
    chrome.kill();
  }
  return results;
}
