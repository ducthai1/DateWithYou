/*
 * Emotion pings mid-ride: every tap shows, on both phones, however often.
 *
 * Reported from a real ride: "spam vài lần các quick react như kẹt xe này kia
 * là nó chết hẳn luôn không dùng được nữa". A tap that draws nothing reads as
 * a dead button, so this counts banners — on the sender and on the partner —
 * one per tap, the same button pressed again and again, at the pace the
 * cool-down allows.
 *
 * Same set-up as nav-overlay.mjs, for the same reason: no Stadia call, the
 * invite straight into Mongo, the route from localStorage.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn, signInAs, PARTNER_EMAIL } from "./session.mjs";

export const name = "Đang đi cùng nhau: bấm cảm xúc bao nhiêu lần cũng hiện";

const HOME = { lat: 10.7769, lng: 106.7009 };
const DEST = { lat: 10.7869, lng: 106.7109 };
const TAPS = 4;
/** A little over the 2.5 s cool-down between two pings. */
const GAP_MS = 2900;

const line = (n = 40) =>
  Array.from({ length: n }, (_, i) => [
    HOME.lng + ((DEST.lng - HOME.lng) * i) / (n - 1),
    HOME.lat + ((DEST.lat - HOME.lat) * i) / (n - 1),
  ]);

/*
 * Count banners as they are ADDED, not as they are seen: two banners four
 * seconds apart overlap on screen, so polling for "is one showing" cannot tell
 * one from two. The banner is keyed by its id, so each ping mounts a new node.
 */
const WATCH = `(() => {
  window.__pings = [];
  new MutationObserver((list) => {
    for (const m of list) for (const n of m.addedNodes) {
      if (n.nodeType !== 1 || !String(n.className).includes("border-2")) continue;
      const t = n.textContent || "";
      if (/Kẹt xe cứng ngắc/.test(t)) window.__pings.push({ at: Date.now(), partner: String(n.className).includes("rose") });
    }
  }).observe(document.body, { childList: true });
  return true;
})()`;

export async function run({ base, profileDir, port, db }) {
  const chromeA = await launchChrome(`${profileDir}-a`, port, { width: 390, height: 844 });
  const A = await openPage(port);
  const chromeB = await launchChrome(`${profileDir}-b`, port + 100, { width: 390, height: 844 });
  const B = await openPage(port + 100);

  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });
  let spaceId = null;

  try {
    for (const [page, geo] of [[A, HOME], [B, { lat: HOME.lat + 0.001, lng: HOME.lng }]]) {
      await page.viewport(390, 844, true);
      await page.send("Emulation.setGeolocationOverride", { latitude: geo.lat, longitude: geo.lng, accuracy: 8 });
      await page.send("Browser.grantPermissions", { permissions: ["geolocation"] }).catch(() => {});
    }

    const host = await signIn(A, base, db);
    spaceId = host.spaceId;
    const guest = await signInAs(B, base, db, { email: PARTNER_EMAIL, name: "Ban doi", spaceId });

    await db.collection("navigationinvites").deleteMany({ spaceId });
    await db.collection("locations").deleteMany({ spaceId, name: "E2E Điểm hẹn" });
    const loc = await db.collection("locations").insertOne({
      spaceId, name: "E2E Điểm hẹn", district: "Phường Sài Gòn", category: "Cà phê", geo: DEST,
      status: "want_to_go", createdBy: host.uid, createdAt: new Date(), updatedAt: new Date(),
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
      spaceId, initiatorId: host.uid, targetId: guest.uid, locationId: locId, locationName: "E2E Điểm hẹn",
      waypoints: [], status: "pending", createdAt: new Date(), expiresAt: new Date(Date.now() + 5 * 60_000),
    });

    const asked = await B.until(`document.body.innerText.includes("Đi liền")`, { timeout: 60000 }).then(() => true).catch(() => false);
    ok("lời mời đi chung tới được máy bên kia", asked);
    if (!asked) return results;
    await B.eval(`[...document.querySelectorAll('button')].find(x => /Đi liền/.test(x.textContent||'')).click()`);
    const riding = await B.until(`!!document.querySelector('[aria-label="Kẹt xe!"]')`, { timeout: 60000 }).then(() => true).catch(() => false);
    ok("đồng ý xong là vào màn hình đang đi", riding);
    if (!riding) return results;
    // Both ends have to be writing positions before a ping has anything to ride on.
    await new Promise((r) => setTimeout(r, 6000));

    await A.eval(WATCH);
    await B.eval(WATCH);
    for (let i = 0; i < TAPS; i++) {
      await B.until(`!document.querySelector('[aria-label="Kẹt xe!"]').disabled`, { timeout: 10000 }).catch(() => {});
      await B.eval(`document.querySelector('[aria-label="Kẹt xe!"]').click()`);
      await new Promise((r) => setTimeout(r, GAP_MS));
    }
    // The partner hears it over a stream that polls once a second.
    await new Promise((r) => setTimeout(r, 2500));

    const mine = JSON.parse(await B.eval(`JSON.stringify(window.__pings.filter(p => !p.partner))`));
    const theirs = JSON.parse(await A.eval(`JSON.stringify(window.__pings.filter(p => p.partner))`));
    ok(`bấm "Kẹt xe!" ${TAPS} lần: máy mình hiện đủ ${TAPS} tấm báo`, mine.length === TAPS, `hiện ${mine.length}`);
    ok(`bấm "Kẹt xe!" ${TAPS} lần: máy người kia hiện đủ ${TAPS} tấm báo`, theirs.length === TAPS, `hiện ${theirs.length}`);

    // And the button still answers after all that.
    const alive = await B.until(`!document.querySelector('[aria-label="Kẹt xe!"]').disabled`, { timeout: 10000 }).then(() => true).catch(() => false);
    ok("sau loạt bấm, nút vẫn bấm được", alive);
  } finally {
    if (spaceId) await db.collection("navigationinvites").deleteMany({ spaceId }).catch(() => {});
    A.close();
    B.close();
    chromeA.kill();
    chromeB.kill();
  }
  return results;
}
