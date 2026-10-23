/*
 * Reload phải để người dùng đứng yên ở đúng chỗ, đúng trạng thái.
 *
 * Người dùng báo: đang đứng ở đâu thì reload vẫn phải đứng yên ở trang đó,
 * trạng thái đó. Trước khi sửa, Thư viện luôn quay về tab "Nhạc" (mặc định
 * của useState) dù đang ở "Công thức" có lọc nhãn và đang mở một thẻ; Lịch
 * về lại tháng này; và mọi trang về đầu, vì app cuộn trong hộp riêng của
 * PageShell chứ không cuộn cửa sổ, nên trình duyệt không có gì để khôi phục.
 *
 * Bài này làm đúng như người dùng: bấm tab, mở thẻ, cuộn — rồi RELOAD thật
 * (Page.reload), và đọc lại. Thêm hai chiều ngược để chắc không sửa quá tay:
 * vào trang bằng link thì bắt đầu từ đầu, và đóng thẻ mở từ link thì reload
 * không mở lại nó.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Reload giữ nguyên trang và trạng thái";

const TAG = "e2e-reload";
const COUNT = 24; // đủ cao để cuộn được ở khổ điện thoại

async function seedRecipes(db, spaceId, uid) {
  await db.collection("mediaitems").deleteMany({ spaceId, tags: TAG });
  const now = Date.now();
  await db.collection("mediaitems").insertMany(
    Array.from({ length: COUNT }, (_, i) => ({
      spaceId,
      kind: "recipe",
      title: `E2E công thức ${String(i + 1).padStart(2, "0")}`,
      tags: [TAG],
      recipe: { ingredients: ["1. Ức gà"], steps: ["Luộc chín"], servings: "1" },
      createdBy: uid,
      createdAt: new Date(now - i * 1000),
      updatedAt: new Date(now - i * 1000),
      __v: 0,
    })),
  );
}

async function reload(page) {
  const loaded = page.waitForEvent("Page.loadEventFired", 60000);
  await page.send("Page.reload");
  await loaded.catch(() => {});
}

/**
 * The box that actually scrolls: PageShell's, the one holding the list.
 *
 * The DEEPEST match, not the first. MainWrapper's window-height frame is also
 * `overflow-y: auto` and comes first in document order, but it never scrolls —
 * measuring it reported "0px of room" on a page four screens tall.
 */
const SCROLLER = `[...document.querySelectorAll("div")].filter((d) =>
  getComputedStyle(d).overflowY === "auto" && d.textContent.includes("E2E công thức 01")).pop()`;

const selectedTab = `[...document.querySelectorAll('[role="tab"]')].find((t) => t.getAttribute("aria-selected") === "true")?.textContent?.trim()`;

/** Click a tab until the URL shows it took — a click before hydration does nothing. */
async function clickTabUntil(page, label, urlPart) {
  await page.until(
    `(() => { if (location.search.includes(${JSON.stringify(urlPart)})) return true;
      [...document.querySelectorAll('[role="tab"]')].find((t) => t.textContent.includes(${JSON.stringify(label)}))?.click();
      return false; })()`,
    { timeout: 60000 },
  );
}

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 390, height: 844 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });

  try {
    await page.viewport(390, 844, true, 2);
    const { uid, spaceId } = await signIn(page, base, db);
    await seedRecipes(db, spaceId, uid);

    // ── Thư viện: tab + thẻ đang mở ────────────────────────────────────────
    await page.goto(`${base}/library`);
    await clickTabUntil(page, "Công thức", "tab=recipe");
    await page.until(`document.body.innerText.includes("E2E công thức 03")`, { timeout: 45000 });

    await page.until(
      `(() => { if (location.search.includes("recipe=")) return true;
        // The title sits above the card's open button, not inside it.
        [...document.querySelectorAll("p")].find((e) => e.textContent.trim() === "E2E công thức 03")
          ?.closest(".group")?.querySelector("button.w-full")?.click();
        return false; })()`,
      { timeout: 20000 },
    );
    const dialogShows = `!!document.querySelector('[role="dialog"]') && document.querySelector('[role="dialog"]').textContent.includes("E2E công thức 03")`;
    await page.until(dialogShows, { timeout: 10000 });
    const before = await page.eval("location.search");

    await reload(page);
    const reopened = await page.until(dialogShows, { timeout: 45000 }).then(() => true).catch(() => false);
    ok("Thư viện: reload xong thẻ công thức vẫn đang mở", reopened);
    const tabAfter = await page.eval(selectedTab);
    ok("Thư viện: reload xong vẫn ở tab Công thức, không về Nhạc", tabAfter === "Công thức", `tab đang chọn: ${tabAfter}`);
    const after = await page.eval("location.search");
    ok("Thư viện: URL giữ nguyên qua reload", after === before, `${before} → ${after}`);

    // Đóng thẻ thì xoá khỏi URL, để reload sau đó không mở lại.
    await page.eval(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`);
    const closed = await page
      .until(`!location.search.includes("recipe=") && !document.querySelector('[role="dialog"]')`, { timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    ok("Thư viện: đóng thẻ thì URL bỏ recipe=", closed, await page.eval("location.search"));

    // ── Vị trí cuộn ────────────────────────────────────────────────────────
    const room = await page.eval(`(() => { const s = ${SCROLLER}; return s ? s.scrollHeight - s.clientHeight : -1; })()`);
    const want = Math.min(1500, Math.max(0, room - 50));
    ok("có đủ chỗ để cuộn (đo trên đúng hộp cuộn của PageShell)", want > 300, `cuộn được ${room}px`);
    await page.eval(`(() => { const s = ${SCROLLER}; s.scrollTop = ${want}; })()`);
    await new Promise((r) => setTimeout(r, 300));
    await reload(page);
    const restored = await page
      .until(`(() => { const s = ${SCROLLER}; return !!s && Math.abs(s.scrollTop - ${want}) < 4; })()`, { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    const top = await page.eval(`(() => { const s = ${SCROLLER}; return s ? Math.round(s.scrollTop) : null; })()`);
    ok(`reload trả hộp cuộn về đúng chỗ cũ (${want}px)`, restored, `đang ở ${top}px`);
    if (shotDir) await page.shot(`${shotDir}/reload-state-scroll.png`);

    // Chiều ngược: vào bằng link (không phải reload) thì bắt đầu từ đầu.
    await page.goto(`${base}/library?tab=recipe`);
    await page.until(`document.body.innerText.includes("E2E công thức 01")`, { timeout: 45000 });
    await new Promise((r) => setTimeout(r, 800));
    const fresh = await page.eval(`(() => { const s = ${SCROLLER}; return s ? Math.round(s.scrollTop) : null; })()`);
    ok("vào bằng link thì ở đầu trang, không bị kéo về chỗ cũ", fresh === 0, `scrollTop ${fresh}`);

    // ── Lịch (máy tính): tháng + tab xem ───────────────────────────────────
    await page.viewport(1440, 900, false);
    await page.goto(`${base}/calendar`);
    await page.until(
      `(() => { if (location.search.includes("month=")) return true;
        document.querySelector('[aria-label="Tháng sau"]')?.click(); return false; })()`,
      { timeout: 60000 },
    );
    const month = await page.eval(`new URLSearchParams(location.search).get("month")`);
    await clickTabUntil(page, "Nhật ký", "view=agenda");
    await reload(page);
    const viewAfter = await page
      .until(`${selectedTab} === "Nhật ký"`, { timeout: 45000 })
      .then(() => true)
      .catch(() => false);
    ok("Lịch: reload xong vẫn ở tab Nhật ký", viewAfter, `tab đang chọn: ${await page.eval(selectedTab)}`);
    const monthAfter = await page.eval(`new URLSearchParams(location.search).get("month")`);
    ok("Lịch: reload xong vẫn ở tháng đã chuyển tới", monthAfter === month && !!month, `${month} → ${monthAfter}`);

    // Link vào một ngày: mở đúng ngày; đóng rồi reload thì không mở lại.
    // Tháng 01 của NĂM NGOÁI: không bao giờ trùng tháng hiện tại (khi đó màn
    // không cần ghim tháng), và là tháng từng bị tính thành 0.
    const y = new Date().getFullYear() - 1;
    await page.goto(`${base}/calendar?d=${y}-01-15`);
    const opened = await page.until(`!!document.querySelector('[role="dialog"]')`, { timeout: 45000 }).then(() => true).catch(() => false);
    ok("Lịch: link ?d= mở đúng ngày", opened);
    await page.eval(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`);
    await page.until(`!document.querySelector('[role="dialog"]')`, { timeout: 10000 }).catch(() => {});
    const pinned = await page.eval(`new URLSearchParams(location.search).get("month")`);
    ok("Lịch: đóng ngày từ link thì tháng của ngày đó được giữ (tháng 01, không phải 0 hay 12)", pinned === `${y}-01`, `month=${pinned}`);
    await reload(page);
    await new Promise((r) => setTimeout(r, 2500));
    const trapped = await page.eval(`!!document.querySelector('[role="dialog"]')`);
    ok("Lịch: reload sau khi đóng không mở lại ngày đó", !trapped);
  } finally {
    await db.collection("mediaitems").deleteMany({ tags: TAG }).catch(() => {});
    page.close();
    chrome.kill();
  }
  return results;
}
