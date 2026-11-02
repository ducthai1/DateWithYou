/*
 * Bộ sưu tập: dán link là có tên.
 *
 * Trước đây lưu một bài YouTube phải tự gõ lại tên bài. Bộ này dán một link
 * YouTube THẬT (oEmbed thật của YouTube, như người dùng) vào form Nhạc, chờ ô
 * tên tự điền, lưu, rồi đọc database. Và chiều ngược lại: gõ tên trước thì dán
 * link không được đè chữ của người dùng.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Bộ sưu tập: dán link YouTube tự điền tên (oEmbed thật), tên đã gõ thì không bị đè";

const LINK = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const inDialog = `document.querySelector('[role="dialog"]')`;
const setField = (sel, value) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return false;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
})()`;
const LINK_FIELD = `[role="dialog"] input[aria-label="Link"]`;
const TITLE_FIELD = `[role="dialog"] input[aria-label="Tên"]`;
const openAdd = `(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim().startsWith("+ Thêm")); if (!b) return false; b.click(); return true; })()`;

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 390, height: 844 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });
  const media = db.collection("mediaitems");
  let spaceId = null;

  try {
    await page.viewport(390, 844, true, 2);
    const session = await signIn(page, base, db);
    spaceId = session.spaceId;
    await media.deleteMany({ spaceId, url: LINK });

    const openForm = async () => {
      await page.goto(`${base}/library?tab=music`);
      await page.until(openAdd.replace("b.click(); return true;", "return true;"), { timeout: 90000 }).catch(() => {});
      await sleep(500);
      await page.eval(openAdd);
      return page.until(`!!document.querySelector(${JSON.stringify(LINK_FIELD)})`, { timeout: 10000 }).then(() => true).catch(() => false);
    };

    ok("form Nhạc mở, ô link đứng trước ô tên", await openForm() && await page.eval(`(() => {
      const l = document.querySelector(${JSON.stringify(LINK_FIELD)}), t = document.querySelector(${JSON.stringify(TITLE_FIELD)});
      return !!l && !!t && l.getBoundingClientRect().top < t.getBoundingClientRect().top;
    })()`));
    await page.eval(setField(LINK_FIELD, LINK));
    const filled = await page.until(`(document.querySelector(${JSON.stringify(TITLE_FIELD)})?.value ?? "").includes("Never Gonna Give You Up")`, { timeout: 20000 })
      .then(() => true).catch(() => false);
    const title = await page.eval(`document.querySelector(${JSON.stringify(TITLE_FIELD)})?.value ?? ""`);
    ok("dán link YouTube → ô tên tự điền từ YouTube", filled, title);
    if (shotDir) await page.shot(`${shotDir}/library-link-title-390.png`);
    await page.eval(`[...${inDialog}.querySelectorAll("button")].find((b) => b.textContent.trim() === "Lưu")?.click()`);
    await page.until(`!document.querySelector('[role="dialog"]')`, { timeout: 15000 }).catch(() => {});
    let row = null;
    for (let i = 0; i < 30 && !row; i++) { row = await media.findOne({ spaceId, url: LINK }); if (!row) await sleep(300); }
    ok("database: lưu với tên lấy từ link", !!row && row.title === title && row.kind === "music", JSON.stringify(row && { title: row.title }));
    await media.deleteMany({ spaceId, url: LINK });

    // A title typed first is the user's; the link must not replace it.
    await openForm();
    await page.eval(setField(TITLE_FIELD, "Bài của tụi mình"));
    await page.eval(setField(LINK_FIELD, LINK));
    await sleep(3000);
    ok("tên đã gõ trước thì dán link không bị đè", (await page.eval(`document.querySelector(${JSON.stringify(TITLE_FIELD)})?.value`)) === "Bài của tụi mình");
  } catch (e) {
    ok("không ném giữa chừng", false, String(e?.message ?? e).slice(0, 200));
  } finally {
    if (spaceId) await media.deleteMany({ spaceId, url: LINK });
    page.close();
    chrome.kill();
  }
  return results;
}
