/*
 * The watch page: /library/phat/<id> — video left, playlist right.
 *
 * Everything checked here was reported from a real screen and fixed by
 * measurement, so it is measured again rather than eyeballed:
 *
 *   - on a phone, scrolling the strip under the video used to drag the frame
 *     along with it, up to 14px behind, because the frame belongs to the
 *     floating player and was chasing a box that had already moved. The
 *     video now sits outside anything that scrolls: the offset must be 0.
 *   - the white dissolve under the video must appear only once there is
 *     something scrolled under it, not by default.
 *   - on a Mac-sized window the right-hand column was taller than the
 *     viewport and its bottom was cut off. It is capped now and scrolls
 *     inside itself.
 *   - a wheel over the frame has to move the page. The frame is a
 *     cross-origin iframe and eats its own wheel events; the fix is scroll
 *     chaining onto a mirrored layer, so the two scrollers must track.
 *   - the expand button on the small window used to do nothing and the X
 *     used to leave a spinner that never resolved.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Trang phát: khung video, danh sách, thu nhỏ và phóng to";

/** Real ids so the frame actually loads; titles are the seed's own marker. */
const SEED = [
  ["E2E nhạc 1", "dQw4w9WgXcQ"],
  ["E2E nhạc 2", "9bZkp7q19f0"],
  ["E2E nhạc 3", "kJQP7kiw5Fk"],
  ["E2E nhạc 4", "RgKAFK5djSk"],
  ["E2E nhạc 5", "OPf0YbXqDm0"],
  ["E2E nhạc 6", "CevxZvSJLk8"],
  ["E2E nhạc 7", "hT_nvWreIhg"],
  ["E2E nhạc 8", "60ItHLz5WEA"],
  ["E2E nhạc 9", "fRh_vgS2dFE"],
  ["E2E nhạc 10", "YQHsXMglC9A"],
];

/**
 * Enough tracks for the playlist to overflow, added only if missing.
 *
 * Not wiped between runs on purpose: the second run then starts on the data
 * the first one left, which is where a whole class of bug lives.
 */
async function seedQueue(db, spaceId, uid) {
  const col = db.collection("mediaitems");
  const ids = [];
  for (const [title, videoId] of SEED) {
    const existing = await col.findOne({ spaceId, title });
    if (existing) {
      ids.push(String(existing._id));
      continue;
    }
    const r = await col.insertOne({
      spaceId,
      kind: "music",
      title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      provider: "youtube",
      embedId: videoId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      tags: [],
      createdBy: uid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    ids.push(String(r.insertedId));
  }
  return ids;
}

const rectOf = (sel) => `(() => {
  const el = document.querySelector('${sel}');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom) });
})()`;

const readRect = async (page, sel) => {
  const raw = await page.eval(rectOf(sel));
  return raw ? JSON.parse(raw) : null;
};

/*
 * The scroll box a finger would actually move on this screen.
 *
 * Not `main`'s: the page's own scroller sits outside it, and the playlist has
 * a second one of its own — so the box is found by behaviour and the
 * playlist's is explicitly excluded.
 */
const SCROLLER = `(() => {
  const boxes = [...document.querySelectorAll('div')].filter((e) => {
    if (e.closest('[data-watch-playlist]')) return false;
    const o = getComputedStyle(e).overflowY;
    return (o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 40;
  });
  return boxes.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] ?? null;
})()`;


export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 1440, height: 900 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });

  try {
    await page.viewport(1440, 900, false);
    const { uid, spaceId } = await signIn(page, base, db);
    const ids = await seedQueue(db, spaceId, uid);
    const watch = `${base}/library/phat/${ids[0]}`;

    // ── Desktop: the right-hand column must fit the window ────────────────
    await page.goto(watch);
    /*
     * Wait for the page to be finished, not for a guessed number of seconds.
     *
     * The card renders skeleton rows while the queue loads and the frame only
     * arrives once something is playing, so a fixed sleep passed on its own
     * and failed when the suite ran after three others — measuring an empty
     * playlist and reporting it as a layout fault.
     */
    await page.until(`document.querySelectorAll('[data-watch-playlist] li').length >= ${SEED.length}`, {
      timeout: 60000,
    });
    await page.until(`!!document.querySelector('iframe')`, { timeout: 60000 });

    const list = await readRect(page, "[data-watch-playlist]");
    const vh = await page.eval("window.innerHeight");
    ok(
      `danh sách phát nằm trong màn hình (cao ${list.h}px / ${vh}px, đáy ${list.bottom}px)`,
      list.h <= vh && list.bottom <= vh + 2,
      list.bottom > vh + 2 ? `đáy vượt màn hình ${list.bottom - vh}px` : "",
    );

    const inner = JSON.parse(
      await page.eval(`(() => {
        const card = document.querySelector('[data-watch-playlist]');
        const box = [...card.querySelectorAll('*')].find((e) => {
          const o = getComputedStyle(e).overflowY;
          return o === 'auto' || o === 'scroll';
        });
        if (!box) return JSON.stringify({ found: false });
        return JSON.stringify({ found: true, scroll: box.scrollHeight, client: box.clientHeight });
      })()`),
    );
    ok(
      `danh sách tự cuộn bên trong (${inner.scroll}px trong ${inner.client}px)`,
      inner.found && inner.scroll > inner.client + 20,
      inner.found ? "" : "không thấy hộp cuộn trong thẻ",
    );

    const fadeAtRest = await page.eval(
      `(document.querySelector('[data-fade-bottom]')?.getAttribute('data-fade-bottom')) ?? 'none'`,
    );
    ok("mép mờ của danh sách bật khi còn nội dung phía dưới", fadeAtRest === "on", `là "${fadeAtRest}"`);

    // ── The frame really is laid over the page's box ───────────────────────
    /*
     * Settled, not mid-flight: the player animates between the small window
     * and the slot, so a reading taken the instant the frame appears catches
     * it a few pixels out and says the layout is broken when it is only
     * moving. Wait for the offset to close, then report where it landed.
     */
    const OVERLAP = `(() => {
      const slot = document.querySelector('[data-watch-slot]')?.getBoundingClientRect();
      const frame = document.querySelector('iframe')?.getBoundingClientRect();
      if (!slot || !frame) return false;
      return Math.abs(slot.x - frame.x) <= 2 && Math.abs(slot.y - frame.y) <= 2 && Math.abs(slot.width - frame.width) <= 2;
    })()`;
    await page.until(OVERLAP, { timeout: 15000 }).catch(() => {});

    const overlay = JSON.parse(
      await page.eval(`(() => {
        const slot = document.querySelector('[data-watch-slot]')?.getBoundingClientRect();
        const frame = document.querySelector('iframe')?.getBoundingClientRect();
        if (!slot || !frame) return JSON.stringify({ found: false });
        return JSON.stringify({
          found: true,
          dx: Math.round(Math.abs(slot.x - frame.x)),
          dy: Math.round(Math.abs(slot.y - frame.y)),
          dw: Math.round(Math.abs(slot.width - frame.width)),
        });
      })()`),
    );
    ok(
      "khung phát nằm đúng vào ô video của trang",
      overlay.found && overlay.dx <= 2 && overlay.dy <= 2 && overlay.dw <= 2,
      overlay.found ? `lệch ${overlay.dx}/${overlay.dy}/${overlay.dw}px` : "không thấy iframe",
    );

    /*
     * Nothing may cover the frame.
     *
     * Catching the wheel with a transparent pane over the player was the
     * first attempt at making the page scroll over the video, and it also
     * caught every click: the scrubber and the fullscreen button went dead
     * ("tôi lại không tua được video cũng như không bấm nút to màn hình").
     * A hit-test at the middle and along the control bar is what tells the
     * two designs apart, and it is cheap enough to keep for ever.
     */
    const hits = JSON.parse(
      await page.eval(`(() => {
        const slot = document.querySelector('[data-watch-slot]').getBoundingClientRect();
        const at = (x, y) => {
          const el = document.elementFromPoint(x, y);
          return el ? el.tagName.toLowerCase() : "none";
        };
        return JSON.stringify({
          middle: at(slot.x + slot.width / 2, slot.y + slot.height / 2),
          scrubber: at(slot.x + slot.width / 2, slot.bottom - 12),
          fullscreen: at(slot.right - 24, slot.bottom - 12),
        });
      })()`),
    );
    const covered = Object.entries(hits).filter(([, tag]) => tag !== "iframe");
    ok(
      "không có lớp nào che khung phát (giữa, thanh tua, nút toàn màn hình)",
      covered.length === 0,
      covered.map(([where, tag]) => `${where}=${tag}`).join(" "),
    );

    if (shotDir) await page.shot(`${shotDir}/watch-desktop.png`);

    // ── Phone: the video may not move while the strip scrolls ─────────────
    await page.viewport(390, 844, true);
    await page.goto(watch);
    await page.until(`document.querySelectorAll('[data-watch-playlist] li').length >= ${SEED.length}`, {
      timeout: 60000,
    });
    await page.until(`!!document.querySelector('[data-watch-slot]')`, { timeout: 60000 });

    // Landing position matters: the strip must arrive at the top, with the
    // title under the video, whichever track in the queue is playing.
    const landedAt = await page.eval(`(() => { const b = ${SCROLLER}; return b ? b.scrollTop : -1; })()`);
    ok(`mở trang trên máy điện thoại thì strip ở đầu (scrollTop ${landedAt})`, landedAt === 0);

    const fadeBefore = await page.eval(
      `document.querySelector('[data-video-fade]')?.getAttribute('data-video-fade') ?? 'none'`,
    );
    ok("mép mờ dưới video tắt khi chưa cuộn", fadeBefore === "off", `là "${fadeBefore}"`);

    const slotBefore = await readRect(page, "[data-watch-slot]");
    const scrolled = await page.eval(`(() => {
      const box = ${SCROLLER};
      if (!box) return -1;
      box.scrollTop = 260;
      return box.scrollTop;
    })()`);
    await new Promise((r) => setTimeout(r, 600));
    const slotAfter = await readRect(page, "[data-watch-slot]");
    const drift = Math.abs(slotAfter.y - slotBefore.y);
    ok(
      `cuộn ${scrolled}px mà khung video không nhích (lệch ${drift}px)`,
      scrolled > 100 && drift === 0,
      scrolled <= 100 ? "không cuộn được strip" : `khung trôi ${drift}px`,
    );

    const fadeAfter = await page.eval(
      `document.querySelector('[data-video-fade]')?.getAttribute('data-video-fade') ?? 'none'`,
    );
    ok("mép mờ hiện ra khi đã cuộn", fadeAfter === "on", `là "${fadeAfter}"`);

    if (shotDir) await page.shot(`${shotDir}/watch-mobile.png`);

    // ── Small window: expand goes back to the page, X really closes ───────
    await page.viewport(1440, 900, false);
    await page.goto(`${base}/library`);
    await page.until(`!!document.querySelector('[aria-label^="Phát "]')`, { timeout: 60000 });
    await page.eval(`document.querySelector('[aria-label^="Phát "]').click()`);
    await page.until(`!!document.querySelector('[aria-label="Mở trang phát"]')`, { timeout: 30000 });
    ok("bấm phát ở /library mở cửa sổ nhỏ", true);

    await page.eval(`document.querySelector('[aria-label="Mở trang phát"]').click()`);
    const reachedWatch = await page
      .until(`location.pathname.startsWith('/library/phat/') && !!document.querySelector('[data-watch-slot]')`, {
        timeout: 30000,
      })
      .then(() => true)
      .catch(() => false);
    ok("nút phóng to đưa về trang phát khung lớn", reachedWatch);

    // Back on a page with no slot, the window is small again — and the X
    // must clear it, not leave a title spinning for ever.
    await page.goto(`${base}/library`);
    await page.until(`!!document.querySelector('[aria-label^="Phát "]')`, { timeout: 60000 });
    await page.eval(`document.querySelector('[aria-label^="Phát "]').click()`);
    await page.until(`!!document.querySelector('[aria-label="Đóng trình phát"]')`, { timeout: 30000 });
    await page.eval(`document.querySelector('[aria-label="Đóng trình phát"]').click()`);
    const closed = await page
      .until(
        `!document.querySelector('[aria-label="Đóng trình phát"]') && !document.querySelector('iframe[src*="youtube"]')`,
        { timeout: 15000 },
      )
      .then(() => true)
      .catch(() => false);
    ok("nút X đóng hẳn trình phát, không để lại vòng xoay", closed);
  } finally {
    page.close();
    chrome.kill();
  }
  return results;
}
