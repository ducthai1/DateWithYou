/*
 * Hai người ngồi xem, KHÔNG ai đụng vào — không được giật.
 *
 * Chủ repo 26/10: "để yên mà cứ giật giật, không đồng bộ" — lặp lại nhiều lần.
 * Các bộ khác đều đo lúc có người bấm; bộ này đo lúc không ai bấm, mỗi giây
 * một lần, và đếm mọi cú nhảy của khung (vị trí đổi khác thời gian trôi quá
 * 0,6 s). Bốn pha, đúng bốn thứ đã làm giật khi đo:
 *  1. để yên;
 *  2. một máy còn chạy bản app CŨ (mở từ trước lần deploy): bản ghi 15 s của
 *     nó không có `kind`, server từng coi là lệnh tua ⇒ máy kia nhảy mỗi 15 s;
 *  3. một người dừng rồi phát tiếp, sau đó để yên: bản ghi định kỳ đầu tiên
 *     của máy kia từng bị đọc nhầm là lệnh và giật máy vừa bấm lùi ~1 s;
 *  4. máy yếu, mạng chậm.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn, signInAs, PARTNER_EMAIL } from "./session.mjs";

export const name = "Xem cùng nhau: để yên thì không giật (cả khi một máy còn bản cũ)";

// Một video dài (Big Buck Bunny, 10:34) để bốn pha không chạy hết bài.
const VIDEO = "aqz-KE-bpKQ";
const AUTOPLAY = ["--autoplay-policy=no-user-gesture-required", "--mute-audio"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const JUMP_SEC = 0.6;

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
const frameCmd = (func, args = []) => `(() => {
  const f = document.querySelector('iframe[src*="youtube"]');
  if (!f) return false;
  f.contentWindow.postMessage(JSON.stringify({ event: "command", func: ${JSON.stringify(func)}, args: ${JSON.stringify(args)} }), "*");
  return true;
})()`;
// The 15 s write of the app as it was on production before commands and refreshes were told apart.
const LEGACY_WRITE = `(() => {
  const t = window.__yt && window.__yt.t;
  if (!(t > 0)) return false;
  fetch("/api/trpc/listen.control?batch=1", {
    method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
    body: JSON.stringify({ 0: { json: { positionSec: t, isPlaying: true, index: 0 } } }),
  });
  return true;
})()`;

export async function run({ base, profileDir, port, db, shotDir }) {
  const hostChrome = await launchChrome(`${profileDir}-host`, port, { width: 1280, height: 860, extraArgs: AUTOPLAY });
  const host = await openPage(port);
  const guestChrome = await launchChrome(`${profileDir}-guest`, port + 1, { width: 1280, height: 860, extraArgs: AUTOPLAY });
  const guest = await openPage(port + 1);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });
  let spaceId = null;
  const read = async (p) => JSON.parse(await p.eval(READ));

  /**
   * Watch both players for `secs` seconds, once a second. A jump is the
   * playhead moving by more than JUMP_SEC differently from the clock while
   * playing. `during(i)` runs before each sample, for the phase's own doings.
   */
  async function watch(secs, during) {
    const jumps = { host: [], guest: [] };
    const gaps = [];
    let prev = null;
    for (let i = 0; i < secs; i++) {
      await sleep(1000);
      if (during) await during(i);
      const now = Date.now();
      const cur = { host: await read(host), guest: await read(guest), now };
      if (prev) {
        for (const who of ["host", "guest"]) {
          const a = prev[who], b = cur[who];
          if (!a.playing || !b.playing) continue;
          const drift = b.t - a.t - (now - prev.now) / 1000;
          if (Math.abs(drift) > JUMP_SEC) jumps[who].push(`${a.t.toFixed(1)}→${b.t.toFixed(1)}`);
        }
      }
      if (cur.host.playing && cur.guest.playing) gaps.push(Math.abs(cur.host.t - cur.guest.t));
      prev = cur;
    }
    gaps.sort((x, y) => x - y);
    const detail = `host ${jumps.host.length} [${jumps.host.join(" ")}] · guest ${jumps.guest.length} [${jumps.guest.join(" ")}] · lệch giữa ${(gaps[Math.floor(gaps.length / 2)] ?? -1).toFixed(2)}s, lớn nhất ${(gaps.at(-1) ?? -1).toFixed(2)}s`;
    return { jumps: jumps.host.length + jumps.guest.length, maxGap: gaps.at(-1) ?? Infinity, samples: gaps.length, detail };
  }

  try {
    await host.viewport(1280, 860, false);
    await guest.viewport(1280, 860, false);
    for (const p of [host, guest]) await p.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    const h = await signIn(host, base, db);
    spaceId = h.spaceId;
    const g = await signInAs(guest, base, db, { email: PARTNER_EMAIL, name: "Ngoc", spaceId });

    let m = await db.collection("mediaitems").findOne({ spaceId, title: "E2E phim dài" });
    if (!m) {
      const r = await db.collection("mediaitems").insertOne({
        spaceId, kind: "music", title: "E2E phim dài", url: `https://www.youtube.com/watch?v=${VIDEO}`, provider: "youtube",
        embedId: VIDEO, embedUrl: `https://www.youtube-nocookie.com/embed/${VIDEO}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${VIDEO}/hqdefault.jpg`, tags: [], createdBy: h.uid,
        createdAt: new Date(), updatedAt: new Date(),
      });
      m = await db.collection("mediaitems").findOne({ _id: r.insertedId });
    }
    const track = { id: String(m._id), kind: m.kind, title: m.title, thumbnailUrl: m.thumbnailUrl, providerLabel: "YouTube", provider: "youtube", embedUrl: m.embedUrl };
    await db.collection("listensessions").deleteMany({ spaceId });
    await db.collection("listensessions").insertOne({
      spaceId, hostId: h.uid, guestId: g.uid, status: "live", queue: [track], index: 0, isPlaying: true, positionSec: 5,
      stateAt: new Date(), updatedBy: h.uid, epoch: 1, commandBy: h.uid, presence: {},
      expiresAt: new Date(Date.now() + 6 * 3600_000), createdAt: new Date(), updatedAt: new Date(),
    });
    for (const p of [host, guest]) {
      await p.goto(`${base}/library/phat/${m._id}`);
      await p.until(`!!document.querySelector('iframe[src*="youtube"]')`, { timeout: 60000 });
      await p.eval(PROBE);
    }
    const started = await (async () => {
      const end = Date.now() + 60000;
      while (Date.now() < end) {
        const a = await read(host), b = await read(guest);
        if (a.playing && b.playing && a.t > 2 && b.t > 2) return true;
        await sleep(700);
      }
      return false;
    })();
    ok("cả hai đang xem cùng", started);
    if (!started) return results;
    await sleep(8000); // the first lining-up is allowed to move the frames

    // ── 1. Để yên ─────────────────────────────────────────────────────────
    let w = await watch(60);
    ok("1. để yên 60 giây: không cú nhảy nào", w.jumps === 0 && w.samples > 50, w.detail);
    ok("1. …và hai bên lệch nhau dưới 1,5 giây", w.maxGap < 1.5, w.detail);

    /*
     * Two phones are rarely within 0.75 s of each other — network latency
     * alone puts them a second or so apart. Side by side in one machine these
     * two often are, and then a wrong "command" moves nobody and the bug hides.
     * So the guest is set 1.2 s behind first, quietly (no hand, no report).
     */
    const behind = async () => {
      const t = (await read(guest)).t;
      await guest.eval(`window.__vivuPlayer && window.__vivuPlayer.seekQuietly(${t - 1.2})`);
      await sleep(3000);
    };

    // ── 2. Một máy còn chạy bản cũ ────────────────────────────────────────
    await behind();
    const epochBefore = (await db.collection("listensessions").findOne({ spaceId }))?.epoch;
    w = await watch(50, async (i) => {
      if (i % 15 === 3) await guest.eval(LEGACY_WRITE);
    });
    const epochAfter = (await db.collection("listensessions").findOne({ spaceId }))?.epoch;
    ok("2. một máy còn bản cũ ghi vị trí mỗi 15 giây: không ai bị giật", w.jumps === 0, w.detail);
    ok("2. …và bản ghi đó không bị tính là lệnh", epochAfter === epochBefore, `epoch ${epochBefore} → ${epochAfter}`);

    // ── 3. Dừng, phát tiếp, rồi để yên ────────────────────────────────────
    await guest.eval(frameCmd("pauseVideo"));
    await sleep(3000);
    await guest.eval(frameCmd("playVideo"));
    await sleep(5000); // following the resume is allowed to line the other one up
    await behind();
    w = await watch(35);
    ok("3. dừng rồi phát tiếp, sau đó để yên: bản ghi kế tiếp không giật máy nào lùi lại", w.jumps === 0, w.detail);

    // ── 4. Máy yếu, mạng chậm ─────────────────────────────────────────────
    await guest.send("Network.enable");
    await guest.send("Network.emulateNetworkConditions", { offline: false, latency: 300, downloadThroughput: 1_500_000 / 8, uploadThroughput: 750_000 / 8 });
    await guest.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    w = await watch(60);
    await guest.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await guest.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    ok("4. máy yếu + mạng chậm, để yên 60 giây: không cú nhảy nào", w.jumps === 0, w.detail);
    if (shotDir) await guest.shot(`${shotDir}/listen-idle-guest.png`);
  } finally {
    if (spaceId) await db.collection("listensessions").deleteMany({ spaceId }).catch(() => {});
    host.close();
    guest.close();
    hostChrome.kill();
    guestChrome.kill();
  }
  return results;
}
