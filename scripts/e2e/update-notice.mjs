/*
 * "Có bản mới — tải lại": một trang đang mở mà server đã lên bản khác.
 *
 * Chủ repo 26/10: một máy còn chạy bản cũ (mở từ trước lần deploy) làm máy kia
 * giật mỗi 15 giây khi xem cùng. Trang nay hỏi `/api/version` mỗi lần người ta
 * quay lại app; khác bản của chính nó thì mời tải lại.
 *
 * Server "đã deploy" được giả bằng cách chặn `/api/version` ở tầng mạng
 * (CDP Fetch) và trả về một build khác. "Quay lại app" là thật: thu nhỏ rồi mở
 * lại cửa sổ — đúng sự kiện điện thoại bắn khi chuyển app.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Có bản mới: trang đang mở được mời tải lại";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NOTICE = `!!document.querySelector("[data-update-notice]")`;

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 1280, height: 860 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });
  try {
    await signIn(page, base, db);
    const own = await page.eval(`fetch("/api/version", { cache: "no-store" }).then((r) => r.json()).then((j) => j.build)`);
    ok("server nói nó đang chạy bản nào", typeof own === "string" && own.length > 0, own);

    // Every /api/version from here on answers with a different build.
    let asked = 0;
    let newBuild = true;
    await page.send("Fetch.enable", { patterns: [{ urlPattern: "*/api/version*" }] });
    page.on("Fetch.requestPaused", (e) => {
      asked++;
      const body = Buffer.from(JSON.stringify({ build: newBuild ? "build-after-deploy" : own })).toString("base64");
      page.send("Fetch.fulfillRequest", {
        requestId: e.requestId,
        responseCode: 200,
        responseHeaders: [{ name: "content-type", value: "application/json" }],
        body,
      }).catch(() => {});
    });
    const { windowId } = await page.send("Browser.getWindowForTarget");
    const away = async () => {
      /*
       * Headless Chrome here only lets a minimise hide the page once focus
       * emulation has been switched on and off again (measured: without it,
       * no visibilitychange at all).
       */
      await page.send("Emulation.setFocusEmulationEnabled", { enabled: true });
      await page.send("Emulation.setFocusEmulationEnabled", { enabled: false });
      await page.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "minimized" } });
      await sleep(800);
      await page.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
    };

    // The marketing pages never ask.
    await page.goto(`${base}/`);
    await sleep(1500);
    asked = 0;
    await away();
    await sleep(2500);
    ok("trang giới thiệu (công khai) không hỏi gì", asked === 0, `hỏi ${asked} lần`);

    await page.goto(`${base}/home`);
    await sleep(2000);
    ok("vừa mở trang thì chưa nói gì", !(await page.eval(NOTICE)));
    await away();
    const shown = await page.until(NOTICE, { timeout: 10000 }).then(() => true).catch(() => false);
    ok("quay lại app sau khi server lên bản mới: mời tải lại", shown, `hỏi ${asked} lần`);
    if (shotDir) await page.shot(`${shotDir}/update-notice.png`);

    await page.eval(`document.querySelector('[data-update-notice] button[aria-label="Để sau"]')?.click()`);
    await sleep(500);
    ok("bấm Để sau thì thôi hiện", !(await page.eval(NOTICE)));

    await away();
    const again = await page.until(NOTICE, { timeout: 10000 }).then(() => true).catch(() => false);
    ok("…lần sau quay lại app thì nhắc lại (không im luôn)", again);

    // Reloading picks up the new build; here the server is made to answer with this page's own build again.
    newBuild = false;
    const loaded = page.waitForEvent("Page.loadEventFired", 60000);
    await page.eval(`[...document.querySelectorAll('[data-update-notice] button')].find((b) => b.textContent.trim() === "Tải lại")?.click()`);
    const reloaded = await loaded.then(() => true).catch(() => false);
    await sleep(1500);
    await away();
    await sleep(2500);
    ok("bấm Tải lại thì trang tải lại, và cùng bản thì không mời nữa", reloaded && !(await page.eval(NOTICE)));
    await page.send("Fetch.disable").catch(() => {});
  } finally {
    page.close();
    chrome.kill();
  }
  return results;
}
