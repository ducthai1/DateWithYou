/*
 * The riding screen, with a partner — every control reachable, at any height.
 *
 * Reported from a real ride: "các nút icon … dường như bị che lẫn nhau … nên
 * bấm vào cứ cảm giác như không có gì xảy ra", and the shrink-to-window button
 * did nothing at all.
 *
 * The overlay used to be four boxes pinned inside one full-height container:
 * the HUD at `top-0`, the speed dial at `top-[40%]`, the four emotion buttons
 * at `top-[60%]`, and the dock at `bottom-0`. Nothing coordinated them, so on
 * a 667px phone the buttons ran to 614px while the dock started at 567px and
 * the last one ("Nhanh lên!") was simply underneath it. Percentages cannot
 * express "whatever is left between these two"; flex rows can, and that is
 * what this proves — at three heights, because the bug only showed on the
 * short ones.
 *
 * Getting here costs no external API calls, which is the reason this can run
 * on every push: the invite is written straight into Mongo (the SSE stream
 * picks it up like any other), and `location.getRoute` is BLOCKED so the page
 * falls back to the line seeded in localStorage. Stadia is never asked.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn, signInAs, PARTNER_EMAIL } from "./session.mjs";

export const name = "Đang đi cùng nhau: không nút nào bị che";

const HOME = { lat: 10.7769, lng: 106.7009 };
const DEST = { lat: 10.7869, lng: 106.7109 };

/** Every control the rider must be able to hit while moving. */
const CONTROLS = ["Nóng quá!", "Kẹt xe!", "Đợi xíu nha", "Nhanh lên!", "Thu nhỏ thành khung nổi"];

/** A straight line from origin to destination — enough to navigate along. */
const line = (n = 40) =>
  Array.from({ length: n }, (_, i) => [
    HOME.lng + ((DEST.lng - HOME.lng) * i) / (n - 1),
    HOME.lat + ((DEST.lat - HOME.lat) * i) / (n - 1),
  ]);

/*
 * Hit-test each control at its own centre.
 *
 * `nextjs-portal` is excluded on purpose: it is the dev-tools overlay, it
 * hosts its indicator in a shadow root over the bottom-left corner, and
 * `elementFromPoint` reports the host. It does not exist in a production
 * build — which is what anyone actually rides with — so counting it as a
 * blocker would fail the suite for something no rider can ever meet.
 */
const AUDIT = (labels) => `(() => {
  const out = [];
  for (const l of ${JSON.stringify(labels)}) {
    const el = document.querySelector('[aria-label="' + l + '"]');
    if (!el) { out.push({ label: l, state: "missing" }); continue; }
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) { out.push({ label: l, state: "zero-size" }); continue; }
    const hit = document.elementFromPoint(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2));
    const devTools = !!hit && hit.tagName.toLowerCase() === "nextjs-portal";
    const reachable = devTools || (!!hit && (el === hit || el.contains(hit) || hit.contains(el)));
    out.push({
      label: l,
      state: reachable ? "ok" : "covered",
      blocker: reachable ? null : (hit ? hit.tagName.toLowerCase() + ":" + ((hit.getAttribute("aria-label") || hit.textContent || "").trim().slice(0, 24)) : "nothing"),
      top: Math.round(r.y),
      bottom: Math.round(r.bottom),
    });
  }
  const dock = document.querySelector('[aria-label="Thu nhỏ thành khung nổi"]')?.closest("div.flex.shrink-0.flex-col");
  const rail = document.querySelector('[aria-label="Nhanh lên!"]');
  return JSON.stringify({
    vh: window.innerHeight,
    controls: out,
    dockTop: dock ? Math.round(dock.getBoundingClientRect().top) : null,
    railBottom: rail ? Math.round(rail.getBoundingClientRect().bottom) : null,
  });
})()`;

export async function run({ base, profileDir, port, db, shotDir }) {
  const chromeA = await launchChrome(`${profileDir}-a`, port, { width: 390, height: 844 });
  const A = await openPage(port);
  // port + 100 for the same reason invite.mjs uses it: `port + 1` is the port
  // the runner hands to the NEXT suite.
  const chromeB = await launchChrome(`${profileDir}-b`, port + 100, { width: 390, height: 844 });
  const B = await openPage(port + 100);

  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });
  let spaceId = null;

  try {
    for (const [page, geo] of [[A, HOME], [B, { lat: HOME.lat + 0.001, lng: HOME.lng }]]) {
      await page.viewport(390, 844, true);
      await page.send("Emulation.setGeolocationOverride", {
        latitude: geo.lat,
        longitude: geo.lng,
        accuracy: 8,
      });
      await page.send("Browser.grantPermissions", { permissions: ["geolocation"] }).catch(() => {});
    }

    const host = await signIn(A, base, db);
    spaceId = host.spaceId;
    const guest = await signInAs(B, base, db, { email: PARTNER_EMAIL, name: "Ban doi", spaceId });

    // A clean slate for this feature: one invite exists per pair at a time, so
    // one left by an interrupted run is the very slot this run needs.
    await db.collection("navigationinvites").deleteMany({ spaceId });
    await db.collection("locations").deleteMany({ spaceId, name: "E2E Điểm hẹn" });
    const loc = await db.collection("locations").insertOne({
      spaceId,
      name: "E2E Điểm hẹn",
      district: "Phường Sài Gòn",
      category: "Cà phê",
      geo: DEST,
      status: "want_to_go",
      createdBy: host.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const locId = String(loc.insertedId);

    for (const page of [A, B]) {
      await page.send("Network.enable");
      await page.send("Network.setBlockedURLs", { urls: ["*location.getRoute*"] });
      await page.goto(`${base}/map`);
      await page.until(`!!document.querySelector('[aria-label="Tìm địa điểm"]')`, { timeout: 60000 });
      await page.eval(`localStorage.setItem("vivu.ride.route", JSON.stringify({
        locationId: ${JSON.stringify(locId)},
        savedAt: Date.now(),
        geometry: { type: "LineString", coordinates: ${JSON.stringify(line())} },
        legs: [{ distanceMeters: 1600, durationSeconds: 300, geometry: { type: "LineString", coordinates: ${JSON.stringify(line())} } }],
        distanceMeters: 1600, durationSeconds: 300, multiLeg: false
      }))`);
    }

    await db.collection("navigationinvites").insertOne({
      spaceId,
      initiatorId: host.uid,
      targetId: guest.uid,
      locationId: locId,
      locationName: "E2E Điểm hẹn",
      waypoints: [],
      status: "pending",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60_000),
    });

    const asked = await B.until(`document.body.innerText.includes("Đi liền")`, { timeout: 60000 })
      .then(() => true)
      .catch(() => false);
    ok("lời mời đi chung tới được máy bên kia", asked);
    if (!asked) return results;

    await B.eval(`[...document.querySelectorAll('button')].find(x => /Đi liền/.test(x.textContent||'')).click()`);
    const riding = await B.until(`!!document.querySelector('[aria-label="Nóng quá!"]')`, { timeout: 60000 })
      .then(() => true)
      .catch(() => false);
    ok("đồng ý xong là vào màn hình đang đi, có hàng nút cảm xúc", riding);
    if (!riding) return results;

    /*
     * Three heights, because the bug was invisible on a tall one. 560px is a
     * phone held in landscape, which is exactly when the rail had least room.
     */
    for (const h of [844, 667, 560]) {
      await B.send("Emulation.setDeviceMetricsOverride", {
        width: 390,
        height: h,
        deviceScaleFactor: 2,
        mobile: true,
      });
      await new Promise((r) => setTimeout(r, 900));
      const audit = JSON.parse(await B.eval(AUDIT(CONTROLS)));
      const bad = audit.controls.filter((c) => c.state !== "ok");
      ok(
        `màn ${h}px: cả ${CONTROLS.length} nút đều bấm được`,
        bad.length === 0,
        bad.map((c) => `${c.label}=${c.state}${c.blocker ? " ← " + c.blocker : ""}`).join(" | "),
      );
      const clear = audit.railBottom != null && audit.dockTop != null && audit.railBottom < audit.dockTop;
      ok(
        `màn ${h}px: hàng nút cảm xúc dừng trên thanh điều khiển (${audit.railBottom} < ${audit.dockTop})`,
        clear,
        clear ? "" : "hàng nút chạy xuống dưới thanh điều khiển — đúng lỗi cũ",
      );
      if (shotDir) await B.shot(`${shotDir}/nav-overlay-${h}.png`);
    }

    /*
     * Bấm một cảm xúc: tấm báo hiện ra phải NHÌN THẤY ĐƯỢC.
     *
     * Người dùng báo ba lần — "các thông báo này đang bị nằm phía dưới các nút
     * button". Hai lần trước sửa trượt vì tưởng là z-index. Không phải: lúc
     * đang đi, khung bản đồ là `z-[49]` còn lớp phủ điều hướng là `z-50`, hai
     * NGỮ CẢNH XẾP CHỒNG khác nhau — nên tấm báo nằm trong bản đồ thì không
     * con số nào ở trong đó nâng nó lên trên thanh điều khiển được.
     *
     * Nên bài này đo hai thứ, và cả hai đều là bất biến chứ không phải mỹ
     * thuật: nó phải nằm NGOÀI cây bản đồ (cha là <body>), và hộp của nó
     * không được chạm vào dải mà thanh điều khiển chiếm.
     */
    await B.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await new Promise((r) => setTimeout(r, 600));
    await B.eval(`document.querySelector('[aria-label="Nóng quá!"]').click()`);
    await new Promise((r) => setTimeout(r, 700));
    const ping = JSON.parse(await B.eval(`(() => {
      const el = [...document.querySelectorAll("div")].find(d =>
        /Nóng quá/.test(d.textContent || "") && String(d.className).includes("border-2"));
      /*
       * Dải phải tránh là THANH ĐIỀU KHIỂN (Tạm dừng · Kết thúc), không phải
       * hàng nút cảm xúc. Bản hỏng đặt tấm báo sát đáy màn — nó KHÔNG chạm
       * hàng nút cảm xúc, nên đo nhầm chỗ thì bài kiểm xanh trong khi tấm báo
       * vẫn nằm sau hai cái nút.
       */
      const pause = [...document.querySelectorAll("button")].find(b => /Tạm dừng/.test(b.textContent || ""));
      let ctrl = pause;
      while (ctrl && !/Kết thúc/.test(ctrl.textContent || "")) ctrl = ctrl.parentElement;
      const dock = ctrl && ctrl.getBoundingClientRect();
      const b = el && el.getBoundingClientRect();
      return JSON.stringify({
        found: !!el,
        outsideMap: !!el && el.parentElement === document.body,
        // Chồng lấn theo chiều dọc với dải của thanh điều khiển.
        overlap: b && dock ? Math.max(0, Math.min(b.bottom, dock.bottom) - Math.max(b.top, dock.top)) : null,
        banner: b ? { y: Math.round(b.top), bottom: Math.round(b.bottom) } : null,
        dock: dock ? { y: Math.round(dock.top), bottom: Math.round(dock.bottom) } : null,
      });
    })()`));
    ok("bấm cảm xúc thì có tấm báo hiện ra", ping.found === true);
    ok(
      "tấm báo nằm NGOÀI cây bản đồ, nên không bị lớp phủ điều hướng đè",
      ping.outsideMap === true,
      ping.outsideMap ? "" : "vẫn nằm trong bản đồ (z-[49]) — đúng lỗi cũ",
    );
    ok(
      "tấm báo không chạm vào thanh Tạm dừng · Kết thúc",
      ping.overlap === 0,
      `chồng ${ping.overlap}px · báo=${JSON.stringify(ping.banner)} thanh=${JSON.stringify(ping.dock)}`,
    );
    if (shotDir) await B.shot(`${shotDir}/nav-ping-banner.png`);
  } finally {
    if (spaceId) await db.collection("navigationinvites").deleteMany({ spaceId }).catch(() => {});
    A.close();
    B.close();
    chromeA.kill();
    chromeB.kill();
  }
  return results;
}
