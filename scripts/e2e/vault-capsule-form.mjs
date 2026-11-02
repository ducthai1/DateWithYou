/*
 * Hộp thời gian: ngày mở bằng chip, tiêu đề tự theo, thư có câu mở đầu.
 *
 * Seed một ngày đặc biệt ~30 ngày nữa để chip "dịp sắp tới" có cái để hiện.
 * Làm như người dùng: đổi chip ngày → tiêu đề đổi theo; chọn dịp → ngày mở là
 * đúng ngày đó; bấm câu mở đầu → vào ô thư; lưu → đọc database. Rồi gõ tiêu
 * đề riêng và đổi chip: tiêu đề của người dùng phải đứng yên.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Hộp thời gian: chip ngày mở (cả dịp sắp tới), tiêu đề theo chip, câu mở đầu, tiêu đề tự gõ không bị đè";

const OCCASION = "E2E Ngày yêu nhau";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const form = `document.querySelector("form[data-capsule-form]")`;
const chip = (text) => `[...(${form}?.querySelectorAll("button") ?? [])].find((b) => b.textContent.replace(/\\s+/g, " ").trim().startsWith(${JSON.stringify(text)}))`;
const pressed = (text) => `(${chip(text)})?.getAttribute("aria-pressed") === "true"`;
const click = (expr) => `(() => { const el = ${expr}; if (!el) return false; el.click(); return true; })()`;
const setField = (sel, value) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return false;
  const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
})()`;
const titleValue = `document.querySelector("#capsule-title")?.value ?? ""`;
const pad = (n) => String(n).padStart(2, "0");

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 390, height: 844 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });
  const capsules = db.collection("timecapsules");
  const special = db.collection("specialdates");
  let spaceId = null;

  try {
    await page.viewport(390, 844, true, 2);
    const session = await signIn(page, base, db);
    spaceId = session.spaceId;
    await capsules.deleteMany({ spaceId, title: { $regex: "E2E|Gửi" } });
    await special.deleteMany({ spaceId, title: OCCASION });
    // 30 days out, in Vietnam's calendar.
    const vn = new Date(Date.now() + 7 * 3600_000 + 30 * 86400_000);
    const occasionDay = `${vn.getUTCFullYear()}-${pad(vn.getUTCMonth() + 1)}-${pad(vn.getUTCDate())}`;
    await special.insertOne({ spaceId, title: OCCASION, date: occasionDay, recurYearly: false, createdBy: session.uid, createdAt: new Date(), updatedAt: new Date(), __v: 0 });

    await page.goto(`${base}/vault?tab=capsules`);
    await page.until(`[...document.querySelectorAll("button")].some((b) => b.textContent.includes("Giấu kỷ niệm"))`, { timeout: 90000 });
    await sleep(500);
    await page.eval(`[...document.querySelectorAll("button")].find((b) => b.textContent.includes("Giấu kỷ niệm"))?.click()`);
    ok("form hiện, mặc định mở sau 1 năm", await page.until(`!!${form} && ${pressed("1 năm")}`, { timeout: 10000 }).then(() => true).catch(() => false));
    // The partner's real name, not the "Người kia" shown while it loads.
    await page.until(`!(${titleValue}).includes("Người kia")`, { timeout: 10000 }).catch(() => {});
    ok("tiêu đề có sẵn theo 1 năm, có tên thật của người kia", (await page.eval(titleValue)).endsWith("của 1 năm sau") && !(await page.eval(titleValue)).includes("Người kia"), await page.eval(titleValue));

    await page.eval(click(chip("6 tháng")));
    await sleep(150);
    ok("bấm 6 tháng → tiêu đề đổi theo", (await page.eval(titleValue)).endsWith("của 6 tháng sau"), await page.eval(titleValue));

    await page.until(`!!${chip(OCCASION)}`, { timeout: 10000 }).catch(() => {});
    ok("ngày đặc biệt sắp tới có chip riêng", await page.eval(`!!${chip(OCCASION)}`));
    await page.eval(click(chip(OCCASION)));
    await sleep(150);
    ok("chọn dịp → tiêu đề \"nhân …\"", (await page.eval(titleValue)).endsWith(`nhân ${OCCASION}`), await page.eval(titleValue));

    await page.eval(click(chip("Cảm ơn vì")));
    await sleep(200);
    ok("bấm câu mở đầu → vào ô thư", (await page.eval(`document.querySelector("#capsule-message").value`)) === "Cảm ơn vì…");
    await page.eval(setField("#capsule-message", "Cảm ơn vì… đã ở đây."));
    if (shotDir) await page.shot(`${shotDir}/vault-capsule-form-390.png`);
    const o = await page.eval(`(() => { const f = ${form}; return f.scrollWidth - f.clientWidth; })()`);
    ok("form không tràn ngang ở 390px", o <= 0, `${o}px`);

    const title = await page.eval(titleValue);
    await page.eval(`${form}.requestSubmit()`);
    let row = null;
    for (let i = 0; i < 40 && !row; i++) { row = await capsules.findOne({ spaceId, title }); if (!row) await sleep(250); }
    const at = row ? new Date(row.unlockDate) : null;
    const local = at && `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
    ok("database: mở đúng ngày của dịp, thư có câu mở đầu", !!row && local === occasionDay && row.message === "Cảm ơn vì… đã ở đây.", JSON.stringify({ local, occasionDay }));

    // A title of their own stays put when the date changes.
    await page.eval(`[...document.querySelectorAll("button")].find((b) => b.textContent.includes("Giấu kỷ niệm"))?.click()`);
    await page.until(`!!${form}`, { timeout: 10000 }).catch(() => {});
    await page.eval(setField("#capsule-title", "Thư riêng của mình"));
    await page.eval(click(chip("3 năm")));
    await sleep(150);
    ok("tiêu đề tự gõ thì đổi chip không bị đè", (await page.eval(titleValue)) === "Thư riêng của mình");
  } catch (e) {
    ok("không ném giữa chừng", false, String(e?.message ?? e).slice(0, 200));
  } finally {
    if (spaceId) {
      await capsules.deleteMany({ spaceId, title: { $regex: "E2E|Gửi" } });
      await special.deleteMany({ spaceId, title: OCCASION });
    }
    page.close();
    chrome.kill();
  }
  return results;
}
