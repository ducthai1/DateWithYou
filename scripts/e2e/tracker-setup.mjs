/*
 * Gửi vị trí khi tắt màn hình: thông báo + nút cấp quyền ngay tại chỗ.
 *
 * Chủ repo chốt 30/10/2026: thiếu quyền nào thì phải có thông báo kèm nút bấm
 * cấp luôn, không bắt người ta tự đi tìm trong Cài đặt. Bộ này đóng vai một
 * chiếc iPhone chưa cấp gì: mở Bản đồ phải thấy từng thứ thiếu kèm nút của
 * nó, bấm nút phải làm đúng việc; rồi đóng vai OwnTracks gửi về báo cáo "chỉ
 * được dùng vị trí khi đang mở" — màn Cài đặt phải nói đúng thế, kèm nút.
 *
 * Không có điện thoại thật ở đây: phần chạy nền của OwnTracks thì phải thử
 * trên máy thật. Bộ này kiểm mọi thứ phía Vivu quanh nó.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Gửi vị trí khi tắt màn hình: thiếu quyền là có nút cấp ngay";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const checks = `JSON.stringify([...document.querySelectorAll('[data-tracking-notice] [data-check], [data-tracking-setup] [data-check]')].map(e => ({
  key: e.dataset.check,
  buttons: [...e.querySelectorAll('button')].map(b => b.textContent.trim()),
  text: e.textContent,
})))`;

const click = (scope, label) =>
  `(() => { const b = [...document.querySelectorAll('${scope} button')].find(x => x.textContent.trim() === ${JSON.stringify(label)}); if (!b) return false; b.click(); return true; })()`;

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 390, height: 844 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });
  let userId = null;

  try {
    await page.viewport(390, 844, true);
    await page.send("Emulation.setUserAgentOverride", { userAgent: IPHONE_UA, platform: "iPhone" });
    await page.send("Emulation.setGeolocationOverride", { latitude: 10.7769, longitude: 106.7009, accuracy: 10 });
    // A phone that has granted nothing yet.
    await page.send("Browser.resetPermissions").catch(() => {});
    const host = await signIn(page, base, db);
    userId = host.uid;
    await db.collection("trackerlinks").deleteMany({ userId });

    const status = await fetch(`${base}/map`).then((r) => r.status);
    ok("/map trả HTTP 200", status === 200, `nhận ${status}`);

    await page.goto(`${base}/map`);
    await page.eval(`localStorage.removeItem("vivu.tracker.declined")`);
    const shown = await page
      .until(`!!document.querySelector('[data-tracking-notice] [data-check="tracker-link"]')`, { timeout: 60000 })
      .then(() => true)
      .catch(() => false);
    ok("mở Bản đồ: có thông báo gợi ý cài app chạy nền", shown);
    if (!shown) return results;

    if (shotDir) await page.shot(`${shotDir}/tracker-notice-map.png`);
    const items = JSON.parse(await page.eval(checks));
    const web = items.find((i) => i.key === "web-location");
    const link = items.find((i) => i.key === "tracker-link");
    ok("chưa cấp vị trí: có mục kèm nút 'Cho phép vị trí'", web?.buttons[0] === "Cho phép vị trí", JSON.stringify(web?.buttons));
    ok("chưa có app nền: nút 'Cài OwnTracks' + 'Kết nối'", JSON.stringify(link?.buttons) === JSON.stringify(["Cài OwnTracks", "Kết nối"]), JSON.stringify(link?.buttons));

    // The quick button must really ask: grant the request it raises, and the item goes.
    await page.send("Browser.grantPermissions", { permissions: ["geolocation"] });
    await page.eval(click("[data-tracking-notice]", "Cho phép vị trí"));
    const gone = await page
      .until(`!document.querySelector('[data-tracking-notice] [data-check="web-location"]')`, { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    ok("bấm 'Cho phép vị trí' → có quyền → mục đó biến mất", gone);

    await page.eval(click("[data-tracking-notice]", "Kết nối"));
    const linked = await page
      .until(`!!document.querySelector('[data-tracking-notice] [data-check="tracker-silent"]')`, { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    ok("bấm 'Kết nối' → đã kết nối, chờ OwnTracks gửi, nút 'Mở OwnTracks'", linked);

    // Play OwnTracks: read the login out of the one-tap link, then post as it would.
    const view = JSON.parse(await page.eval(`fetch('/api/trpc/tracker.status').then(r => r.text())`));
    const cfgLink = view?.result?.data?.json?.configLink ?? view?.result?.data?.configLink;
    const cfg = JSON.parse(Buffer.from(decodeURIComponent(String(cfgLink).split("inline=")[1]), "base64").toString("utf8"));
    ok("link một chạm đặt chu kỳ 25 giây", cfg.locatorInterval === 25 && cfg.moveModeLocatorInterval === 25, `${cfg.locatorInterval}/${cfg.moveModeLocatorInterval}`);
    const auth = "Basic " + Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64");
    const send = (body) =>
      fetch(`${base}/api/track/owntracks`, { method: "POST", headers: { "content-type": "application/json", authorization: auth }, body: JSON.stringify(body) });
    const r1 = await send({ _type: "location", lat: 10.78, lon: 106.71, tst: Math.floor(Date.now() / 1000), acc: 10, batt: 55, m: 2 });
    const asked = JSON.parse(await r1.text());
    ok("OwnTracks gửi vị trí → 200 và server hỏi lại quyền", r1.status === 200 && asked.some((m) => m.action === "status"), `${r1.status} ${JSON.stringify(asked)}`);
    await send({ _type: "status", iOS: { locationManagerAuthorizationStatus: "authorizedWhenInUse", backgroundRefreshStatus: "available" } });

    const settings = await fetch(`${base}/settings`).then((r) => r.status);
    ok("/settings trả HTTP 200", settings === 200, `nhận ${settings}`);
    await page.goto(`${base}/settings`);
    const warned = await page
      .until(`!!document.querySelector('[data-tracking-setup] [data-check="tracker-location"]')`, { timeout: 60000 })
      .then(() => true)
      .catch(() => false);
    const after = JSON.parse(await page.eval(checks)).find((i) => i.key === "tracker-location");
    ok(
      "Cài đặt: 'chỉ được dùng vị trí khi đang mở' kèm nút 'Mở OwnTracks' và đúng chỗ chọn 'Luôn luôn'",
      warned && after?.buttons[0] === "Mở OwnTracks" && /Luôn luôn/.test(after.text),
      JSON.stringify(after?.buttons),
    );
    if (shotDir) {
      await page.eval(`document.querySelector('[data-tracking-setup]')?.scrollIntoView({ block: "start" })`);
      await new Promise((r) => setTimeout(r, 400));
      await page.shot(`${shotDir}/tracker-setup-settings.png`);
    }
    const proof = await page.eval(`document.querySelector('[data-tracker-status]')?.textContent || ''`);
    ok("Cài đặt: thấy lần nhận gần nhất và pin từ OwnTracks", /giây trước/.test(proof) && /pin 55%/.test(proof), proof);

    // "Nhà": one tap where they stand, so the other person hears "đã về nhà / vừa rời nhà".
    await page.eval(click("[data-tracker-home]", "Chỗ đang đứng là nhà"));
    const homeSet = await page
      .until(`document.querySelector('[data-tracker-home]')?.dataset.trackerHome === "set"`, { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    if (shotDir && homeSet) {
      await page.eval(`document.querySelector('[data-tracker-home]')?.scrollIntoView({ block: "center" })`);
      await new Promise((r) => setTimeout(r, 400));
      await page.shot(`${shotDir}/tracker-home-set.png`);
    }
    const stored = await db.collection("trackerlinks").findOne({ userId });
    ok(
      "Cài đặt: bấm 'Chỗ đang đứng là nhà' → lưu đúng chỗ đang đứng",
      homeSet && Math.abs((stored?.home?.lat ?? 0) - 10.7769) < 0.0005,
      JSON.stringify(stored?.home),
    );
    const r2 = JSON.parse(await (await send({ _type: "location", lat: 10.7769, lon: 106.7009, tst: Math.floor(Date.now() / 1000), acc: 10, m: 2 })).text());
    ok("OwnTracks gửi lần sau → được cài vùng 'Nhà'", r2.some((m) => m.action === "setWaypoints" && m.waypoints?.waypoints?.[0]?.desc === "Nhà"), JSON.stringify(r2));

    // A trip the tracker saw, nobody pressed anything: it is on the ride list.
    const spaceId = stored?.spaceId;
    const t0 = Date.now() - 2 * 3600_000;
    const pts = [];
    for (let i = 0; i <= 48; i++) pts.push({ at: t0 + i * 25_000, lat: 10.7769, lng: 106.7009 });
    const leave = pts[pts.length - 1].at;
    for (let i = 1; i <= 36; i++) pts.push({ at: leave + i * 25_000, lat: 10.7769 + i * 0.0015, lng: 106.7009 });
    const end = pts[pts.length - 1];
    for (let i = 1; i <= 72; i++) pts.push({ at: end.at + i * 25_000, lat: end.lat, lng: end.lng });
    await db.collection("trackpoints").insertMany(pts.map((p) => ({ spaceId, userId, at: new Date(p.at), lat: p.lat, lng: p.lng, accuracy: 10 })));
    await db.collection("trackerlinks").updateOne({ userId }, { $set: { tripsCheckedAt: null, tripCursorAt: new Date(t0 - 1000) } });
    await page.goto(`${base}/rides`);
    const listed = await page
      .until(`!!document.querySelector('[data-ride-source="tracker"]')`, { timeout: 60000 })
      .then(() => true)
      .catch(() => false);
    ok("trang Chuyến đi: chuyến OwnTracks tự ghi hiện ra, gắn nhãn 'Tự ghi'", listed);
    const totals = await page.eval(`document.body.innerText.match(/(\\d+) chuyến · ([\\d.,]+ ?k?m)/)?.[0] || ""`);
    ok("trang Chuyến đi: ô tổng đếm luôn chuyến vừa tự ghi", /^1 chuyến · 6[.,]0 km$/.test(totals), totals);
    if (shotDir && listed) await page.shot(`${shotDir}/tracker-auto-ride.png`);
    // The pace it learned would slow every route this dev space asks for.
    await db.collection("speedcells").deleteMany({ spaceId });
  } finally {
    if (userId) {
      await db.collection("trackerlinks").deleteMany({ userId }).catch(() => {});
      await db.collection("livelocations").deleteMany({ userId }).catch(() => {});
      await db.collection("trackpoints").deleteMany({ userId }).catch(() => {});
      await db.collection("rides").deleteMany({ userId, source: "tracker" }).catch(() => {});
    }
    page.close();
    chrome.kill();
  }
  return results;
}
