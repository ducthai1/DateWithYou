/*
 * /map: the tool column, and the air around it.
 *
 * The map is fixed and full-bleed under everything, so the left-hand column
 * is `pointer-events-none` on purpose — every pixel of the air it stretches
 * over (measured 774px of it on a desktop, holding maybe 200px of cards) has
 * to belong to the map, or a drag meant to pan the city is swallowed by an
 * invisible box.
 *
 * The cards then have to ask for events back, and for a while two of them
 * never did: the search field and the "N địa điểm đã lưu" button were simply
 * dead on a desktop — every click on them panned the map instead. It was
 * hit-tested by hand at the time with `elementFromPoint`; this makes that
 * permanent, in both directions, because the two mistakes are opposite. Give
 * the rule to the wrapper and the air eats drags; give it to no card and the
 * cards are dead.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Bản đồ: cột công cụ bắt click, khoảng trống thuộc về bản đồ";

/** Two saved places with pins, written straight in — `location.create`
 *  resolves an area from the coordinates over the network. */
async function seedPins(db, spaceId, uid) {
  const col = db.collection("locations");
  const pins = [
    ["E2E Quán A", 10.7769, 106.7009],
    ["E2E Quán B", 10.7869, 106.7109],
  ];
  for (const [name_, lat, lng] of pins) {
    if (await col.findOne({ spaceId, name: name_ })) continue;
    await col.insertOne({
      spaceId,
      name: name_,
      district: "Phường Sài Gòn",
      category: "Cà phê",
      geo: { lat, lng },
      status: "want_to_go",
      createdBy: uid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

/**
 * What is under a point, named the way a person would.
 *
 * Returns the tag plus the nearest aria-label or text, so a failure says
 * "canvas" or "button: 12 địa điểm đã lưu" rather than an anonymous div.
 */
/** The left nav rail's right edge — probes must start to the right of it. */
const RAIL = `(() => {
  const rail = [...document.querySelectorAll('nav, aside')]
    .map((e) => e.getBoundingClientRect())
    .filter((r) => r.height > 400 && r.x < 200 && r.width > 40)
    .sort((a, b) => b.height - a.height)[0];
  return rail ? Math.round(rail.right) : 0;
})()`;

const AT = `(x, y) => {
  const el = document.elementFromPoint(x, y);
  if (!el) return "nothing";
  const tag = el.tagName.toLowerCase();
  if (tag === "canvas") return "canvas";
  const named = el.closest("[aria-label]");
  const label = named ? named.getAttribute("aria-label") : (el.textContent || "").trim().slice(0, 40);
  return tag + (label ? ": " + label : "");
}`;

/**
 * Land on /map, and be sure of it.
 *
 * The first navigation after a server start sometimes ends up on `/` instead
 * — seen twice while the tool-column fix was being hit-tested, with a valid
 * session cookie, and `curl` on the same cookie answering 200 for /map, so it
 * is not the middleware turning it away. Whether that is the app or the
 * harness is still open; either way a suite that navigates once and asserts
 * immediately goes red for a reason that has nothing to do with what it is
 * testing.
 *
 * So: navigate, check where we actually ARE, and try again. Returns how many
 * attempts it took, which is worth printing — if that number starts climbing,
 * the redirect is real and getting worse.
 */
async function gotoMap(page, base) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(`${base}/map`);
    const arrived = await page
      .until(`location.pathname === '/map' && !!document.querySelector('[aria-label="Tìm địa điểm"]')`, {
        timeout: 20000,
      })
      .then(() => true)
      .catch(() => false);
    if (arrived) return attempt;
  }
  return 0;
}

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 1600, height: 900 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });

  try {
    await page.viewport(1600, 900, false);
    const { uid, spaceId } = await signIn(page, base, db);
    await seedPins(db, spaceId, uid);

    const attempts = await gotoMap(page, base);
    ok(
      `vào được /map${attempts > 1 ? ` (phải thử ${attempts} lần)` : ""}`,
      attempts > 0,
      attempts === 0 ? "ba lần điều hướng đều không ở lại /map" : "",
    );
    if (!attempts) return results;

    // MapLibre's first draw on this machine takes several seconds; the veil
    // marks itself idle when the map settles, which is the honest signal.
    const booted = await page
      .until(`!!document.querySelector('canvas') && !!document.querySelector('[data-veil-idle]')`, {
        timeout: 90000,
      })
      .then(() => true)
      .catch(() => false);
    ok("bản đồ vẽ xong và lớp chờ ngừng chạy", booted);
    if (!booted) return results;

    const canvas = JSON.parse(
      await page.eval(`(() => {
        const c = document.querySelector('canvas').getBoundingClientRect();
        return JSON.stringify({ w: Math.round(c.width), h: Math.round(c.height) });
      })()`),
    );
    ok(`bản đồ trải kín màn hình (${canvas.w}×${canvas.h})`, canvas.w > 1200 && canvas.h > 700);

    // ── The column's own cards must catch their clicks ────────────────────
    const hits = JSON.parse(
      await page.eval(`(() => {
        const at = ${AT};
        const centreOf = (el) => {
          const r = el.getBoundingClientRect();
          return [r.x + r.width / 2, r.y + r.height / 2];
        };
        const search = document.querySelector('[aria-label="Tìm địa điểm"]');
        const saved = [...document.querySelectorAll('button')]
          .find((b) => /địa điểm đã lưu/.test(b.textContent || ''));
        const out = { search: "missing", saved: "missing", air: "missing" };
        if (search) out.search = at(...centreOf(search));
        if (saved) out.saved = at(...centreOf(saved));

        /*
         * The air: found by probing rather than by guessing at class names.
         * Walk down the middle of the column and take the first point below
         * the last card. That region is what the wrapper stretches over, and
         * the map has to own every pixel of it.
         */
        const x = Math.round((${RAIL} + 340) / 2);
        let lastCard = 0;
        for (let y = 80; y < window.innerHeight - 20; y += 10) {
          if (!at(x, y).startsWith("canvas")) lastCard = y;
        }
        const airY = lastCard + 40;
        if (lastCard > 0 && airY < window.innerHeight - 20) {
          out.air = at(x, airY);
          out.airY = airY;
          out.airX = x;
        }
        return JSON.stringify(out);
      })()`),
    );

    ok(
      `ô tìm kiếm nhận được click (${hits.search})`,
      hits.search !== "missing" && !hits.search.startsWith("canvas"),
      hits.search.startsWith("canvas") ? "bản đồ đang nằm trên ô tìm kiếm" : "",
    );
    ok(
      `nút "địa điểm đã lưu" nhận được click (${hits.saved})`,
      hits.saved !== "missing" && !hits.saved.startsWith("canvas"),
      hits.saved.startsWith("canvas") ? "bản đồ đang nằm trên nút" : "",
    );
    ok(
      `khoảng trống trong cột thuộc về bản đồ (y=${hits.airY ?? "?"} → ${hits.air})`,
      hits.air === "canvas",
      hits.air === "canvas"
        ? ""
        : hits.air === "missing"
          ? "không tìm được khoảng trống để đo"
          : "một hộp vô hình đang ăn thao tác kéo",
    );

    // ── The search field really takes typing ──────────────────────────────
    const typed = await page.eval(`(() => {
      const el = document.querySelector('[aria-label="Tìm địa điểm"]');
      if (!el) return "missing";
      el.focus();
      return document.activeElement === el ? "focused" : "not-focused";
    })()`);
    ok("ô tìm kiếm nhận được con trỏ", typed === "focused", typed);

    // ── Saved pins are drawn ──────────────────────────────────────────────
    const counted = await page
      .until(
        `[...document.querySelectorAll('button')].some((b) => /[1-9]\\d* địa điểm đã lưu/.test(b.textContent || ''))`,
        { timeout: 30000 },
      )
      .then(() => true)
      .catch(() => false);
    ok(
      "danh sách chỗ đã lưu tải xong (nút không đứng ở 0)",
      counted,
      counted ? "" : "nút vẫn báo 0 dù không gian có chỗ đã lưu",
    );

    const markers = await page.eval(
      `document.querySelectorAll('.maplibregl-marker').length`,
    );
    ok(`chỗ đã lưu hiện thành pin trên bản đồ (${markers})`, markers >= 2);
    if (shotDir) await page.shot(`${shotDir}/map-panel-open.png`);

    // ── Collapsed, the column gives everything back ───────────────────────
    const collapsed = await page.eval(`(() => {
      const b = document.querySelector('[aria-label="Thu gọn bảng điều khiển"]');
      if (!b) return false;
      b.click();
      return true;
    })()`);
    if (collapsed) {
      await new Promise((r) => setTimeout(r, 900));
      /*
       * Collapsed, the whole band the column occupied has to be the map's —
       * an invisible card that still eats clicks is the other half of this
       * bug. Scanned, not sampled at one point: one dead pixel is enough to
       * make a drag feel broken, and the probe must not land on the nav rail
       * (which is SUPPOSED to catch clicks).
       */
      const swept = JSON.parse(
        await page.eval(`(() => {
          const at = ${AT};
          const from = ${RAIL} + 12;
          const blockers = [];
          for (let x = from; x < 360; x += 28) {
            for (let y = 90; y < window.innerHeight - 40; y += 40) {
              const hit = at(x, y);
              if (!hit.startsWith("canvas")) blockers.push(x + "," + y + " → " + hit);
            }
          }
          return JSON.stringify({ from, blockers: blockers.slice(0, 4), count: blockers.length });
        })()`),
      );
      ok(
        `thu gọn xong thì cả dải cột trả về bản đồ (quét từ x=${swept.from})`,
        swept.count === 0,
        swept.blockers.join(" | "),
      );
      if (shotDir) await page.shot(`${shotDir}/map-panel-collapsed.png`);
    } else {
      ok("thu gọn xong thì chỗ của cột trả về bản đồ", false, "không thấy nút thu gọn");
    }

    /*
     * The phone, where the desktop rule does not apply at all.
     *
     * The `pointer-events` dance above is behind `lg:`, so below that the
     * column is an ordinary sheet over the map and the air question is
     * meaningless. What IS worth checking is the half nobody had measured:
     * the search field must still take a tap at 390px. Measured, the
     * "N địa điểm đã lưu" button is 0x0 there — it lives behind the panel
     * toggle — so it is deliberately not asserted on this pass rather than
     * asserted against something that is not on screen.
     */
    await page.viewport(390, 844, true);
    const phoneAttempts = await gotoMap(page, base);
    if (!phoneAttempts) {
      ok("điện thoại: vào được /map", false, "ba lần điều hướng đều không ở lại /map");
    } else {
      await page
        .until(`!!document.querySelector('canvas') && !!document.querySelector('[data-veil-idle]')`, {
          timeout: 90000,
        })
        .catch(() => {});
      const phone = JSON.parse(
        await page.eval(`(() => {
          const at = ${AT};
          const search = document.querySelector('[aria-label="Tìm địa điểm"]');
          const r = search ? search.getBoundingClientRect() : null;
          const c = document.querySelector('canvas');
          const cr = c ? c.getBoundingClientRect() : null;
          return JSON.stringify({
            searchHit:
              r && r.width > 0
                ? at(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2))
                : "missing",
            canvasW: cr ? Math.round(cr.width) : 0,
            canvasH: cr ? Math.round(cr.height) : 0,
          });
        })()`),
      );
      ok(
        `điện thoại: ô tìm kiếm nhận được tap (${phone.searchHit})`,
        phone.searchHit !== "missing" && !phone.searchHit.startsWith("canvas"),
        phone.searchHit.startsWith("canvas") ? "bản đồ đang nằm trên ô tìm kiếm" : "",
      );
      ok(
        `điện thoại: bản đồ trải kín màn hình (${phone.canvasW}×${phone.canvasH})`,
        phone.canvasW >= 380 && phone.canvasH > 600,
      );
      if (shotDir) await page.shot(`${shotDir}/map-phone.png`);
    }
  } finally {
    page.close();
    chrome.kill();
  }
  return results;
}
