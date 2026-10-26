/*
 * Xoay ngang trình phát trên điện thoại.
 *
 * Chủ repo báo 26/10: toàn màn hình của YouTube giữ màn dọc; bật xoay tự động
 * của máy thì nó xoay theo mỗi lần lắc. Nút "Xoay ngang" của app xoay khung
 * một lần rồi đứng yên. Headless không khoá hướng màn hình được, nên đây đo
 * đúng đường dự phòng của iPhone: khung xoay 90° bằng CSS, phủ kín màn dọc.
 *
 * Ba điều phải giữ: phủ KHÍT cả màn (lệch một mép là lộ trang phía sau), khung
 * phát là CÙNG một iframe (dựng lại là video chạy lại từ đầu), và nút back
 * thoát chế độ này chứ không rời trang.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Xoay ngang trình phát: phủ kín, không dựng lại khung, back để thoát";

const TITLE = "E2E xoay ngang";
const VIDEO = "YQHsXMglC9A";

const PANEL = `document.querySelector('[role="region"][aria-label^="Đang phát"]')`;
const rect = (expr) => `(() => { const el = ${expr}; if (!el) return null; const r = el.getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }); })()`;
const clickText = (label) => `(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === ${JSON.stringify(label)}); if (!b) return false; b.click(); return true; })()`;

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 390, height: 844 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });

  try {
    await page.viewport(390, 844, true, 2);
    // A phone: what makes `(pointer: coarse)` true, which is when the button exists.
    await page.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    const { uid, spaceId } = await signIn(page, base, db);
    let item = await db.collection("mediaitems").findOne({ spaceId, title: TITLE });
    if (!item) {
      const r = await db.collection("mediaitems").insertOne({
        spaceId, kind: "music", title: TITLE, url: `https://www.youtube.com/watch?v=${VIDEO}`, provider: "youtube",
        embedId: VIDEO, embedUrl: `https://www.youtube-nocookie.com/embed/${VIDEO}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${VIDEO}/hqdefault.jpg`, tags: [], createdBy: uid,
        createdAt: new Date(), updatedAt: new Date(),
      });
      item = { _id: r.insertedId };
    }
    const path = `/library/phat/${item._id}`;
    await page.goto(`${base}${path}`);

    const button = await page
      .until(`[...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Xoay ngang") && !!document.querySelector('iframe[src*="youtube"]')`, { timeout: 60000 })
      .then(() => true)
      .catch(() => false);
    ok("trên điện thoại có nút Xoay ngang cạnh khung phát", button);
    if (!button) return results;
    // Mark the frame: if landscape mode re-creates it, the mark is gone (and the video restarted).
    await page.eval(`document.querySelector('iframe[src*="youtube"]').dataset.e2eMark = "same"`);
    const slot = JSON.parse(await page.eval(rect(`document.querySelector('[data-watch-slot]')`)));
    // Before turning: whether the frame draws at all here, so a black frame later can be told apart.
    await new Promise((r) => setTimeout(r, 2500));
    if (shotDir) await page.shot(`${shotDir}/player-landscape-before.png`);

    // ── Vào ─────────────────────────────────────────────────────────────────
    await page.eval(clickText("Xoay ngang"));
    await page.until(`!!document.querySelector('[aria-label="Thoát xoay ngang"]')`, { timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 600));
    const box = JSON.parse(await page.eval(rect(PANEL)) ?? "null");
    ok("khung phát phủ KHÍT cả màn 390×844", !!box && box.x === 0 && box.y === 0 && box.w === 390 && box.h === 844, JSON.stringify(box));
    const frame = JSON.parse(await page.eval(rect(`document.querySelector('iframe[src*="youtube"]')`)) ?? "null");
    ok("video nằm ngang: khung trước khi xoay rộng 844, cao 390", await page.eval(`(() => { const f = document.querySelector('iframe[src*="youtube"]'); return f.offsetWidth === 844 && f.offsetHeight === 390; })()`), JSON.stringify(frame));
    ok("vẫn là CÙNG khung phát — video không bị chạy lại từ đầu", (await page.eval(`document.querySelector('iframe[src*="youtube"]')?.dataset.e2eMark`)) === "same");
    const how = await page.eval(`JSON.stringify({ fullscreen: document.fullscreenElement?.getAttribute("aria-label")?.slice(0, 9) ?? null, transform: getComputedStyle(${PANEL}).transform })`);
    ok("(chẩn đoán) nhánh đã chạy", true, how);
    const onTop = await page.eval(`(() => { const el = document.elementFromPoint(195, 600); return !!el && !!el.closest('[role="region"][aria-label^="Đang phát"]'); })()`);
    ok("nằm trên cả thanh điều hướng (điểm giữa-dưới màn thuộc về khung phát)", onTop);
    // YouTube re-lays its frame out after the resize (358×201 → 844×390): shot
    // too early, the picture is plain black, which once read as a bug here.
    await new Promise((r) => setTimeout(r, 3500));
    if (shotDir) await page.shot(`${shotDir}/player-landscape.png`);

    // ── Thoát bằng nút ✕ ────────────────────────────────────────────────────
    await page.eval(`document.querySelector('[aria-label="Thoát xoay ngang"]').click()`);
    await new Promise((r) => setTimeout(r, 700));
    const backInSlot = JSON.parse(await page.eval(rect(PANEL)) ?? "null");
    ok("nút ✕: khung về đúng chỗ trong trang", !!backInSlot && Math.abs(backInSlot.y - slot.y) <= 2 && Math.abs(backInSlot.w - slot.w) <= 2, JSON.stringify({ backInSlot, slot }));

    // ── Thoát bằng nút back ─────────────────────────────────────────────────
    await page.eval(clickText("Xoay ngang"));
    await page.until(`!!document.querySelector('[aria-label="Thoát xoay ngang"]')`, { timeout: 10000 }).catch(() => {});
    await page.eval(`history.back()`);
    const left = await page
      .until(`!document.querySelector('[aria-label="Thoát xoay ngang"]')`, { timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    await new Promise((r) => setTimeout(r, 800));
    ok("nút back: thoát xoay ngang", left);
    ok("…mà vẫn ở lại trang phát", (await page.eval(`location.pathname`)) === path, await page.eval(`location.pathname`));
    ok("…và vẫn là khung phát cũ", (await page.eval(`document.querySelector('iframe[src*="youtube"]')?.dataset.e2eMark`)) === "same");
  } finally {
    page.close();
    chrome.kill();
  }
  return results;
}
