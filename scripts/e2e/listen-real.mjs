/*
 * Xem cùng nhau như người thật ngồi xem — không phải cả hai để yên một chỗ.
 *
 * Chủ repo 26/10: tự đề ra các ca thực tế ngoài happy case, sửa triệt để, và
 * khi người kia thao tác thì màn hình phải NÓI đó là người kia (không thì một
 * cú dừng trông như treo, một cú nhảy trông như mạng giật).
 *
 * Mỗi ca đọc thẳng từ khung YouTube của từng bên (vị trí, đang phát hay không)
 * và từ dòng thông báo của app (`[data-listen-notice]`).
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn, signInAs, PARTNER_EMAIL } from "./session.mjs";

export const name = "Xem cùng nhau: thao tác thật từ cả hai phía, mạng chập chờn, có thông báo";

const TRACKS = [
  ["E2E đồng bộ 1", "60ItHLz5WEA"],
  ["E2E đồng bộ 2", "fRh_vgS2dFE"],
];
const AUTOPLAY = ["--autoplay-policy=no-user-gesture-required", "--mute-audio"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROBE = `(() => {
  if (window.__probe) return true;
  window.__probe = true;
  window.__yt = { t: -1, state: null };
  window.addEventListener("message", (e) => {
    let d; try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
    if (!d || d.info == null) return;
    if (typeof d.info.currentTime === "number") window.__yt.t = d.info.currentTime;
    if (typeof d.info.playerState === "number") window.__yt.state = d.info.playerState;
    if (typeof d.info === "number") window.__yt.state = d.info;
  });
  return true;
})()`;
const READ = `JSON.stringify({ t: window.__yt ? window.__yt.t : -1, playing: !!(window.__yt && window.__yt.state === 1) })`;
const NOTICE = `(document.querySelector("[data-listen-notice]")?.textContent ?? "")`;
const frameCmd = (func, args = []) => `(() => {
  const f = document.querySelector('iframe[src*="youtube"]');
  if (!f) return false;
  f.contentWindow.postMessage(JSON.stringify({ event: "command", func: ${JSON.stringify(func)}, args: ${JSON.stringify(args)} }), "*");
  return true;
})()`;

async function reload(page) {
  const loaded = page.waitForEvent("Page.loadEventFired", 60000);
  await page.send("Page.reload");
  await loaded.catch(() => {});
}

export async function run({ base, profileDir, port, db, shotDir }) {
  const hostChrome = await launchChrome(`${profileDir}-host`, port, { width: 1280, height: 860, extraArgs: AUTOPLAY });
  const host = await openPage(port);
  const guestChrome = await launchChrome(`${profileDir}-guest`, port + 1, { width: 1280, height: 860, extraArgs: AUTOPLAY });
  const guest = await openPage(port + 1);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });
  let spaceId = null;
  const session = () => db.collection("listensessions").findOne({ spaceId });
  const read = async (p) => JSON.parse(await p.eval(READ));
  const both = async () => ({ host: await read(host), guest: await read(guest) });
  /** Poll until `pred(state)` holds or time runs out; returns the last state seen. */
  const until = async (pred, ms) => {
    const end = Date.now() + ms;
    let s = await both();
    while (Date.now() < end) {
      if (pred(s)) return { ok: true, s };
      await sleep(700);
      s = await both();
    }
    return { ok: pred(s), s };
  };
  const near = (a, b, tol = 2) => Math.abs(a - b) < tol;
  const fmt = (s) => JSON.stringify({ h: [+s.host.t.toFixed(1), s.host.playing], g: [+s.guest.t.toFixed(1), s.guest.playing] });

  try {
    await host.viewport(1280, 860, false);
    await guest.viewport(1280, 860, false);
    const h = await signIn(host, base, db);
    spaceId = h.spaceId;
    const g = await signInAs(guest, base, db, { email: PARTNER_EMAIL, name: "Ngoc", spaceId });
    const ObjectId = (await import("mongodb")).ObjectId;
    const ids = [];
    for (const [title, videoId] of TRACKS) {
      let m = await db.collection("mediaitems").findOne({ spaceId, title });
      if (!m) {
        const r = await db.collection("mediaitems").insertOne({
          spaceId, kind: "music", title, url: `https://www.youtube.com/watch?v=${videoId}`, provider: "youtube",
          embedId: videoId, embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
          thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, tags: [], createdBy: h.uid,
          createdAt: new Date(), updatedAt: new Date(),
        });
        m = await db.collection("mediaitems").findOne({ _id: r.insertedId });
      }
      ids.push(String(m._id));
    }
    const track = async (id) => {
      const m = await db.collection("mediaitems").findOne({ _id: ObjectId.createFromHexString(id) });
      return { id, kind: m.kind, title: m.title, thumbnailUrl: m.thumbnailUrl, providerLabel: "YouTube", provider: "youtube", embedUrl: m.embedUrl };
    };
    await db.collection("listensessions").deleteMany({ spaceId });
    await db.collection("listensessions").insertOne({
      spaceId, hostId: h.uid, guestId: g.uid, status: "live",
      queue: [await track(ids[0]), await track(ids[1])], index: 0, isPlaying: true, positionSec: 0,
      stateAt: new Date(), updatedBy: h.uid, epoch: 1, commandBy: h.uid,
      expiresAt: new Date(Date.now() + 6 * 3600_000), createdAt: new Date(), updatedAt: new Date(),
    });
    for (const p of [host, guest]) {
      await p.goto(`${base}/library/phat/${ids[0]}`);
      await p.until(`!!document.querySelector('iframe[src*="youtube"]')`, { timeout: 60000 });
      await p.eval(PROBE);
    }
    const started = await until((s) => s.host.playing && s.guest.playing && s.host.t > 2 && s.guest.t > 2, 60000);
    ok("cả hai đang xem cùng", started.ok, fmt(started.s));
    if (!started.ok) return results;
    const hasNotice = (p, needle) => p.until(`${NOTICE}.includes(${JSON.stringify(needle)})`, { timeout: 8000 }).then(() => true).catch(() => false);

    // ── 1. Người kia tạm dừng / phát tiếp ─────────────────────────────────
    await host.eval(frameCmd("pauseVideo"));
    let r = await until((s) => !s.guest.playing && !s.host.playing && near(s.host.t, s.guest.t, 1.5), 8000);
    ok("1. bên kia dừng → máy mình dừng đúng chỗ", r.ok, fmt(r.s));
    ok("1. …và màn hình nói rõ là người kia dừng", await hasNotice(guest, "vừa tạm dừng"), await guest.eval(NOTICE));
    await host.eval(frameCmd("playVideo"));
    r = await until((s) => s.guest.playing && s.host.playing && near(s.host.t, s.guest.t), 8000);
    ok("1. bên kia phát tiếp → máy mình phát theo", r.ok, fmt(r.s));
    ok("1. …có thông báo phát tiếp", await hasNotice(guest, "phát tiếp"), await guest.eval(NOTICE));

    // ── 2. Người kia tua ──────────────────────────────────────────────────
    await host.eval(frameCmd("seekTo", [120, true]));
    r = await until((s) => s.guest.t > 119 && s.guest.playing && near(s.host.t, s.guest.t), 12000);
    ok("2. bên kia tua tới 2:00 → máy mình nhảy theo và vẫn phát", r.ok, fmt(r.s));
    ok("2. …thông báo nói là người kia tua, kèm giờ", await hasNotice(guest, "tua tới 2:0"), await guest.eval(NOTICE));

    // ── 3. Tua trong lúc đang dừng ────────────────────────────────────────
    await guest.eval(frameCmd("pauseVideo"));
    await until((s) => !s.host.playing, 8000);
    await sleep(1500);
    await guest.eval(frameCmd("seekTo", [40, true]));
    r = await until((s) => near(s.host.t, 40, 1.5) && !s.host.playing && !s.guest.playing, 8000);
    ok("3. tua lúc đang dừng: bên kia nhảy tới đó và VẪN dừng", r.ok, fmt(r.s));
    ok("3. …thông báo tua lại 0:40 ở bên kia", await hasNotice(host, "tua lại 0:4"), await host.eval(NOTICE));
    await host.eval(frameCmd("playVideo"));
    r = await until((s) => s.host.playing && s.guest.playing && near(s.host.t, s.guest.t), 8000);
    ok("3. …rồi phát tiếp từ đúng chỗ đó", r.ok && r.s.guest.t < 50, fmt(r.s));

    // ── 4. Hai người cùng bấm dừng một lúc ────────────────────────────────
    await Promise.all([host.eval(frameCmd("pauseVideo")), guest.eval(frameCmd("pauseVideo"))]);
    await sleep(6000);
    let a = await both();
    await sleep(8000);
    let b = await both();
    ok(
      "4. cùng bấm dừng: cả hai dừng, không lật qua lật lại",
      !a.host.playing && !a.guest.playing && !b.host.playing && !b.guest.playing && near(b.host.t, b.guest.t, 1.5),
      `${fmt(a)} → ${fmt(b)}`,
    );
    await host.eval(frameCmd("playVideo"));
    await until((s) => s.host.playing && s.guest.playing, 8000);

    // ── 5. Một người dừng đúng lúc người kia tua ──────────────────────────
    await Promise.all([guest.eval(frameCmd("pauseVideo")), host.eval(frameCmd("seekTo", [160, true]))]);
    await sleep(7000);
    a = await both();
    await sleep(8000);
    b = await both();
    const agree = (s) => s.host.playing === s.guest.playing && near(s.host.t, s.guest.t);
    ok("5. dừng và tua cùng lúc: hai bên về CÙNG một trạng thái và giữ nguyên", agree(a) && agree(b) && a.host.playing === b.host.playing, `${fmt(a)} → ${fmt(b)}`);
    if (!b.host.playing) {
      await host.eval(frameCmd("playVideo"));
      await until((s) => s.host.playing && s.guest.playing, 8000);
    }

    // ── 6. Tua liên tục ───────────────────────────────────────────────────
    for (const at of [60, 95, 130]) {
      await host.eval(frameCmd("seekTo", [at, true]));
      await sleep(500);
    }
    r = await until((s) => s.guest.t > 129 && s.guest.playing && near(s.host.t, s.guest.t), 12000);
    ok("6. tua liên tục 3 lần: bên kia dừng ở cú cuối, vẫn phát", r.ok, fmt(r.s));

    // ── 7. Một máy bị tụt vì mạng (không phải tay ai tua) ─────────────────
    const quiet = await guest.eval(`typeof window.__vivuPlayer?.seekQuietly === "function"`);
    if (!quiet) {
      ok("7. máy chậm (bỏ qua: bản này chưa có móc thử)", true, "no hook");
    } else {
      const hostTrail = [];
      const now = await both();
      await guest.eval(`window.__vivuPlayer.seekQuietly(${now.guest.t - 6})`);
      for (let i = 0; i < 34; i++) {
        hostTrail.push((await read(host)).t);
        await sleep(1000);
      }
      const back = hostTrail.some((t, i) => i > 0 && t < hostTrail[i - 1] - 1);
      const end7 = await both();
      ok("7. máy chậm KHÔNG kéo máy kia lùi", !back, hostTrail.map((t) => t.toFixed(0)).join(","));
      ok("7. …máy chậm tự đuổi kịp", near(end7.host.t, end7.guest.t, 3), fmt(end7));
      ok("7. …và nói rõ là đang bắt kịp, không phải người kia tua", (await guest.eval(NOTICE)).includes("Bắt kịp") || (await guest.eval(`document.body.dataset.lastListenNotice ?? ""`)).includes("Bắt kịp"), await guest.eval(NOTICE));
    }

    // ── 8. Tải lại trang lúc đang dừng ────────────────────────────────────
    await host.eval(frameCmd("pauseVideo"));
    await until((s) => !s.guest.playing && !s.host.playing, 8000);
    const pausedAt = (await read(host)).t;
    await reload(guest);
    await guest.until(`!!document.querySelector('iframe[src*="youtube"]')`, { timeout: 60000 }).catch(() => {});
    await guest.eval(PROBE);
    await sleep(10000);
    const s8 = await session();
    const after8 = await both();
    ok("8. tải lại lúc đang dừng: phiên vẫn DỪNG (không tự phát lại cho cả hai)", s8?.isPlaying === false && !after8.host.playing, `session.isPlaying=${s8?.isPlaying} ${fmt(after8)}`);
    ok("8. …và máy vừa tải lại đứng đúng chỗ đang dừng", !after8.guest.playing && near(after8.guest.t, pausedAt, 2), `${fmt(after8)} pausedAt=${pausedAt.toFixed(1)}`);
    await host.eval(frameCmd("playVideo"));
    await until((s) => s.host.playing && s.guest.playing, 10000);

    // ── 9. Máy mình mất mạng một lúc, người kia thao tác trong lúc đó ─────
    await guest.send("Network.enable");
    await guest.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await sleep(5000);
    const lost = await guest.eval(`(document.querySelector("[data-listen-connection]")?.textContent ?? "")`);
    ok("9. mất mạng: màn hình nói là MẠNG CỦA MÌNH, không phải người kia", /mất kết nối/i.test(lost), lost);
    await host.eval(frameCmd("pauseVideo"));
    await sleep(3000);
    await guest.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    r = await until((s) => !s.guest.playing && !s.host.playing && near(s.host.t, s.guest.t, 1.5), 20000);
    ok("9. có mạng lại: máy mình làm theo cú dừng người kia bấm lúc mình mất mạng", r.ok, fmt(r.s));

    // ── 10. Mình bấm trong lúc mất mạng ───────────────────────────────────
    /*
     * Hai ngả. Không ai thao tác trong lúc đó: điều mình bấm vẫn còn đúng, gửi
     * khi có mạng lại. Người kia đã thao tác SAU cú bấm của mình: cú bấm cũ
     * không được đè lên họ — bỏ, và nói cho mình biết.
     */
    const offline = (on) =>
      guest.send("Network.emulateNetworkConditions", { offline: on, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    const toldMe = (p, needle) =>
      p.until(`(${NOTICE} + " " + (document.body.dataset.lastListenNotice ?? "")).includes(${JSON.stringify(needle)})`, { timeout: 15000 })
        .then(() => true).catch(() => false);
    await offline(true);
    await sleep(1500);
    await guest.eval(frameCmd("playVideo")); // phiên đang dừng từ ca 9
    await sleep(4000);
    const failed = await guest.eval(`(document.querySelector("[data-listen-connection]")?.textContent ?? "")`);
    ok("10. bấm phát lúc mất mạng: báo là CHƯA GỬI ĐƯỢC", /chưa gửi được/i.test(failed), failed);
    const hostToldResume = toldMe(host, "phát tiếp");
    await offline(false);
    r = await until((s) => s.guest.playing && s.host.playing && near(s.host.t, s.guest.t), 20000);
    const s10 = await session();
    ok("10. …không ai thao tác trong lúc đó: có mạng lại thì gửi, hai bên phát cùng một chỗ", r.ok && s10?.isPlaying === true, `${fmt(r.s)} session.isPlaying=${s10?.isPlaying}`);
    ok("10. …bên kia được báo là MÌNH phát tiếp", await hostToldResume, await host.eval(`document.body.dataset.lastListenNotice ?? ""`));

    await offline(true);
    await sleep(1500);
    await guest.eval(frameCmd("pauseVideo"));
    await sleep(2000);
    await host.eval(frameCmd("seekTo", [100, true]));
    await sleep(3000);
    const guestToldDropped = toldMe(guest, "không được gửi");
    await offline(false);
    r = await until((s) => s.guest.playing && s.host.playing && near(s.host.t, s.guest.t) && s.host.t > 99 && s.host.t < 125, 20000);
    const s10b = await session();
    ok("10. …người kia tua trong lúc mình mất mạng: cú dừng cũ bị bỏ, cả hai theo cú tua", r.ok && s10b?.isPlaying === true, `${fmt(r.s)} session.isPlaying=${s10b?.isPlaying}`);
    ok("10. …và mình được báo là cú bấm đó không được gửi", await guestToldDropped, await guest.eval(`document.body.dataset.lastListenNotice ?? ""`));

    // ── 11. Người kia dừng nghe cùng ──────────────────────────────────────
    await host.eval(`[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Dừng")?.click()`);
    const told = await guest.until(`document.body.innerText.includes("đã dừng nghe cùng")`, { timeout: 15000 }).then(() => true).catch(() => false);
    ok("11. người kia bấm Dừng: máy mình được báo", told);
    if (shotDir) await guest.shot(`${shotDir}/listen-real-guest.png`);

    /*
     * 11b. Người kia bấm Dừng đúng lúc máy mình đang mất kết nối. Một stream nối
     * lại sau đó không thấy phiên nào và không nói gì — lần chạy đầu bắt được
     * đúng khe này: máy khách vẫn ghi "Đang nghe cùng" với không ai.
     */
    await db.collection("listensessions").deleteMany({ spaceId });
    await db.collection("listensessions").insertOne({
      spaceId, hostId: h.uid, guestId: g.uid, status: "live",
      queue: [await track(ids[0]), await track(ids[1])], index: 0, isPlaying: true, positionSec: 10,
      stateAt: new Date(), updatedBy: h.uid, epoch: 1, commandBy: h.uid,
      expiresAt: new Date(Date.now() + 6 * 3600_000), createdAt: new Date(), updatedAt: new Date(),
    });
    const liveAgain = await Promise.all(
      [host, guest].map((p) => p.until(`document.body.innerText.includes("Đang nghe cùng")`, { timeout: 30000 }).then(() => true).catch(() => false)),
    );
    if (!liveAgain.every(Boolean)) {
      ok("11b. (không dựng lại được phiên để thử)", false, JSON.stringify(liveAgain));
    } else {
      await offline(true);
      await sleep(2000);
      await host.eval(`[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Dừng")?.click()`);
      await sleep(3000);
      await offline(false);
      const toldLate = await guest
        .until(`document.body.innerText.includes("đã dừng nghe cùng") && !document.body.innerText.includes("Đang nghe cùng")`, { timeout: 20000 })
        .then(() => true).catch(() => false);
      ok("11b. người kia bấm Dừng lúc máy mình mất kết nối: có mạng lại thì được báo và thôi nghe cùng", toldLate);
    }
  } finally {
    if (spaceId) await db.collection("listensessions").deleteMany({ spaceId }).catch(() => {});
    host.close();
    guest.close();
    hostChrome.kill();
    guestChrome.kill();
  }
  return results;
}
