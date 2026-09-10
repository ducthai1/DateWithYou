/*
 * Every picture the app draws, on the screens that draw the most of them.
 *
 * The check is deliberately dumb: no image may 404, and every image element
 * must have decoded (naturalWidth > 0). That is enough to catch the whole
 * class of asset accident — a renamed file, a re-encoded folder, a registry
 * that still names the old extension — which is otherwise invisible until
 * someone opens the page.
 *
 * Note on dev: the dev server serves optimised images from a cache, so after
 * swapping asset files you must restart it or this can pass on artefacts of
 * the files you just deleted. `run.mjs` says so where you will read it.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn, PAGES_WITH_ART } from "./session.mjs";

export const name = "Ảnh: không 404, và giải mã được";

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 1440, height: 900 });
  const page = await openPage(port);
  const failed = [];
  const results = [];
  await page.send("Network.enable");
  page.on("Network.responseReceived", (e) => {
    if (e.response.status >= 400 && /\.(webp|png|jpe?g|avif|svg)|_next\/image/.test(e.response.url)) {
      failed.push(`${e.response.status} ${e.response.url.slice(0, 110)}`);
    }
  });
  try {
    await page.viewport(1440, 900, false);
    await signIn(page, base, db);
    for (const [label, path] of PAGES_WITH_ART) {
      await page.goto(base + path);
      await new Promise((r) => setTimeout(r, 2600));
      // Scroll to the end so anything lazy is fetched too.
      await page.eval(`(() => { const box = [...document.querySelectorAll('*')].find(e => { const o = getComputedStyle(e).overflowY; return (o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 200; }); if (box) box.scrollTop = box.scrollHeight; else window.scrollTo(0, document.body.scrollHeight); })()`);
      await new Promise((r) => setTimeout(r, 2200));
      const imgs = JSON.parse(await page.eval(`JSON.stringify([...document.querySelectorAll('img')].map(i => ({ src: (i.currentSrc || i.src).slice(-95), w: i.naturalWidth, done: i.complete })))`));
      const broken = imgs.filter((x) => x.done && x.w === 0);
      results.push({ ok: broken.length === 0, name: `${label}: ${imgs.length} ảnh, giải mã được`, detail: broken.slice(0, 2).map((b) => b.src).join(" | ") });
      if (shotDir) await page.shot(`${shotDir}/images-${label}.png`);
    }
    results.push({ ok: failed.length === 0, name: "không ảnh nào lỗi tải", detail: failed.slice(0, 4).join(" | ") });
  } finally {
    page.close();
    chrome.kill();
  }
  return results;
}
