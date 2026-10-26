/*
 * Xem cùng nhau phải ĐI CÙNG nhau — qua một cú tua, một lần rời app, một lần
 * tải lại trang. Hai trình duyệt, hai hồ sơ, như hai cái điện thoại.
 *
 * Chủ repo báo 26/10:
 *   - tua thì không đồng bộ: bản ghi vị trí 15 giây/lần của máy kia đè cú tua,
 *     và máy vừa tua bị kéo ngược về;
 *   - một người chuyển sang app khác rồi quay lại thì có lúc bị đá khỏi phiên
 *     luôn, phải nhờ người kia mời lại: iOS tải lại trang, trang phát nhận bài
 *     theo URL trước khi phiên kịp tới, và tự KẾT THÚC phiên cho cả hai;
 *   - rời app thì iOS dừng video, và cú dừng đó bị báo sang máy kia như thể
 *     người dùng bấm.
 *
 * Vị trí phát đọc thẳng từ khung YouTube (sự kiện `infoDelivery` gửi lên trang),
 * không đọc từ giao diện của app — đo cái người ta NGHE, không đo cái app tin.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn, signInAs, PARTNER_EMAIL } from "./session.mjs";

export const name = "Xem cùng nhau: tua, rời app, tải lại trang";

const TRACKS = [
  ["E2E đồng bộ 1", "60ItHLz5WEA"],
  ["E2E đồng bộ 2", "fRh_vgS2dFE"],
];
const AUTOPLAY = ["--autoplay-policy=no-user-gesture-required", "--mute-audio"];

async function seed(db, spaceId, uid) {
  const ids = [];
  for (const [title, videoId] of TRACKS) {
    const existing = await db.collection("mediaitems").findOne({ spaceId, title });
    if (existing) {
      ids.push(String(existing._id));
      continue;
    }
    const r = await db.collection("mediaitems").insertOne({
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

/** Remember the frame's own playhead and state as it reports them. */
const PROBE = `(() => {
  if (window.__probe) return true;
  window.__probe = true;
  window.__yt = { t: -1, state: null, at: 0 };
  window.addEventListener("message", (e) => {
    let d; try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
    if (!d || !d.info) return;
    if (typeof d.info.currentTime === "number") window.__yt.t = d.info.currentTime;
    if (typeof d.info.playerState === "number") window.__yt.state = d.info.playerState;
    if (typeof d.info === "number") window.__yt.state = d.info;
    window.__yt.at = Date.now();
  });
  return true;
})()`;
const T = `(window.__yt ? window.__yt.t : -1)`;
const PLAYING = `(window.__yt && window.__yt.state === 1)`;
/** Send a command straight into the frame — what a hand on YouTube's own controls does. */
const frameCmd = (func, args = []) => `(() => {
  const f = document.querySelector('iframe[src*="youtube"]');
  if (!f) return false;
  f.contentWindow.postMessage(JSON.stringify({ event: "command", func: ${JSON.stringify(func)}, args: ${JSON.stringify(args)} }), "*");
  return true;
})()`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

  try {
    await host.viewport(1280, 860, false);
    await guest.viewport(1280, 860, false);
    const h = await signIn(host, base, db);
    spaceId = h.spaceId;
    const g = await signInAs(guest, base, db, { email: PARTNER_EMAIL, name: "Ban doi", spaceId });
    const [t1, t2] = await seed(db, spaceId, h.uid);

    /*
     * A live session straight into the database: how it got live is the job of
     * the `listen` suite. This one starts where the reported bugs start.
     */
    await db.collection("listensessions").deleteMany({ spaceId });
    const track = async (id) => {
      const m = await db.collection("mediaitems").findOne({ _id: (await import("mongodb")).ObjectId.createFromHexString(id) });
      return { id, kind: m.kind, title: m.title, thumbnailUrl: m.thumbnailUrl, providerLabel: "YouTube", provider: "youtube", embedUrl: m.embedUrl };
    };
    await db.collection("listensessions").insertOne({
      spaceId,
      hostId: h.uid,
      guestId: g.uid,
      status: "live",
      queue: [await track(t1), await track(t2)],
      index: 0,
      isPlaying: true,
      positionSec: 0,
      stateAt: new Date(),
      updatedBy: h.uid,
      epoch: 1,
      commandBy: h.uid,
      expiresAt: new Date(Date.now() + 6 * 3600_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Every control each side sends, in order — what to read when a check fails.
    const t0 = Date.now();
    const sent = [];
    for (const [who, p] of [["host", host], ["guest", guest]]) {
      await p.send("Network.enable");
      p.on("Network.requestWillBeSent", (e) => {
        if (!/listen\.control/.test(e.request.url)) return;
        sent.push(`${who}@${((Date.now() - t0) / 1000).toFixed(1)}s ${(e.request.postData ?? "").replace(/.*"json":/, "").slice(0, 120)}`);
      });
    }
    const commands = () => sent.join(" | ");

    for (const p of [host, guest]) {
      await p.goto(`${base}/library/phat/${t1}`);
      await p.until(`!!document.querySelector('iframe[src*="youtube"]')`, { timeout: 60000 });
      await p.eval(PROBE);
    }
    const bothPlaying = await Promise.all(
      [host, guest].map((p) => p.until(`${PLAYING} && ${T} > 2`, { timeout: 60000 }).then(() => true).catch(() => false)),
    );
    ok("vào trang phát giữa phiên: cả hai bên đều tự chạy theo phiên", bothPlaying.every(Boolean), JSON.stringify(bothPlaying));
    if (!bothPlaying.every(Boolean)) return results;

    // ── 1. Một bên tua ──────────────────────────────────────────────────────
    await host.eval(frameCmd("seekTo", [70, true]));
    await sleep(7000);
    const afterSeek = { host: await host.eval(T), guest: await guest.eval(T) };
    ok(
      "bên rủ tua tới 1:10 thì bên kia theo kịp",
      afterSeek.guest > 70 && Math.abs(afterSeek.host - afterSeek.guest) < 3,
      JSON.stringify(afterSeek),
    );
    // Long enough for both phones' 15 s position refresh to have been written.
    await sleep(20000);
    const later = { host: await host.eval(T), guest: await guest.eval(T) };
    ok(
      "qua một vòng ghi vị trí định kỳ, cú tua KHÔNG bị kéo ngược",
      later.host > 90 && later.guest > 90 && Math.abs(later.host - later.guest) < 3,
      JSON.stringify(later),
    );

    // ── 2. Một bên rời app ──────────────────────────────────────────────────
    await guest.eval(`(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    })()`);
    // What iOS does to a backgrounded video.
    await guest.eval(frameCmd("pauseVideo"));
    await sleep(4000);
    const whileAway = await session();
    ok("bên kia rời app (video bị hệ điều hành dừng): phiên vẫn đang phát", whileAway?.isPlaying === true, `isPlaying=${whileAway?.isPlaying}`);
    ok("…và bên rủ vẫn chạy", await host.eval(PLAYING));

    await guest.eval(`(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    })()`);
    const together = async (timeoutMs) => {
      const until = Date.now() + timeoutMs;
      let last = null;
      while (Date.now() < until) {
        last = { host: await host.eval(T), guest: await guest.eval(T), guestPlaying: await guest.eval(PLAYING) };
        if (last.guestPlaying && Math.abs(last.host - last.guest) < 3) return { ok: true, last };
        await sleep(1000);
      }
      return { ok: false, last };
    };
    const hostBefore = await host.eval(T);
    const back = await together(15000);
    ok(
      "quay lại app: tự bắt kịp chỗ đang phát, không kéo bên kia lùi",
      back.ok && back.last.host >= hostBefore,
      JSON.stringify({ hostBefore, ...back.last }),
    );

    // ── 3. Một bên tải lại trang (iOS hay làm vậy khi quay về app) ─────────
    await reload(guest);
    await guest.until(`!!document.querySelector('iframe[src*="youtube"]')`, { timeout: 60000 }).catch(() => {});
    await guest.eval(PROBE);
    await sleep(3000);
    const afterReload = await session();
    ok("tải lại trang giữa phiên: phiên KHÔNG bị kết thúc", afterReload?.status === "live", `status=${afterReload?.status}`);
    const rejoined = await together(30000);
    ok("…và bên đó tự vào lại đúng chỗ đang phát", rejoined.ok, JSON.stringify(rejoined.last));
    const where = await guest.eval(`location.pathname`);
    const s = await session();
    const sessionTrack = s?.queue?.[s?.index]?.id;
    ok(
      "…vẫn đúng bài của phiên",
      where === `/library/phat/${sessionTrack}` && sessionTrack === t1,
      JSON.stringify({ guest: where, host: await host.eval(`location.pathname`), sessionIndex: s?.index, sessionTrack, t1, epoch: s?.epoch, commandBy: s?.commandBy === h.uid ? "host" : s?.commandBy === g.uid ? "guest" : s?.commandBy, commands: commands() }),
    );
    if (shotDir) await guest.shot(`${shotDir}/listen-sync-guest.png`);
  } finally {
    if (spaceId) await db.collection("listensessions").deleteMany({ spaceId }).catch(() => {});
    host.close();
    guest.close();
    hostChrome.kill();
    guestChrome.kill();
  }
  return results;
}
