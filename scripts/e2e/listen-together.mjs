/*
 * Nghe cùng nhau, with two browsers — because one browser cannot be wrong
 * about the other one.
 *
 * Every check here is a bug that was reported from two real phones:
 *
 *   "bên kia còn chưa chấp nhận mà bên này đã chạy bài hát luôn rồi"
 *      the host must hold at the beginning until the answer arrives, so the
 *      two of them start together.
 *   "bên kia chấp nhận xong thì vào màn hình /library/phat luôn chứ, hiện
 *    tại đang chỉ mở phần frame nhỏ thôi"
 *      accepting lands the guest on the full watch page.
 *   "bấm qua bài thì cả 2 bên đều bị mở khung nhỏ ra là không đúng, phải xem
 *    trạng thái hiện tại đang là khung to hay nhỏ thì giữ nguyên"
 *      a skip changes the track and nothing else — whoever was on the big
 *      player stays on it.
 *
 * The two browsers are separate Chrome processes with separate profiles, so
 * the two sessions are as independent as two devices.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn, signInAs, PARTNER_EMAIL } from "./session.mjs";

export const name = "Nghe cùng nhau: hai trình duyệt, một hàng đợi";

/** Click the button whose visible text is exactly this. */
const clickText = (label) => `(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)});
  if (!b || b.disabled) return false;
  b.click();
  return true;
})()`;

/*
 * Click a button inside the card that carries this heading.
 *
 * "Nghe cùng" is also the label on every media card's own invite control, and
 * those come first in the DOM — clicking by text alone pressed one of them
 * instead of the modal, which sent a NEW invite back the other way and made
 * the run look like the accept had silently failed. Scoping to the smallest
 * element containing the heading is what tells the modal from the page.
 */
const clickInCard = (heading, label) => `(() => {
  const cards = [...document.querySelectorAll('div')].filter((d) => d.textContent.includes(${JSON.stringify(heading)}) && d.querySelector('button'));
  const card = cards.sort((a, b) => a.textContent.length - b.textContent.length)[0];
  if (!card) return "no-card";
  const b = [...card.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)});
  if (!b) return "no-button";
  if (b.disabled) return "disabled";
  b.click();
  return "clicked";
})()`;

const hasText = (needle) => `document.body.innerText.includes(${JSON.stringify(needle)})`;

export async function run({ base, profileDir, port, db, shotDir }) {
  const hostChrome = await launchChrome(`${profileDir}-host`, port, { width: 1440, height: 900 });
  const host = await openPage(port);
  const guestChrome = await launchChrome(`${profileDir}-guest`, port + 1, { width: 1440, height: 900 });
  const guest = await openPage(port + 1);

  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });

  try {
    await host.viewport(1440, 900, false);
    await guest.viewport(1440, 900, false);
    const { spaceId } = await signIn(host, base, db);
    await signInAs(guest, base, db, { email: PARTNER_EMAIL, name: "Ban doi", spaceId });

    // A space with two members is what makes the invite button exist at all.
    const members = (await db.collection("spaces").findOne({ _id: (await import("mongodb")).ObjectId.createFromHexString(spaceId) })).members;
    ok(`không gian có 2 thành viên (${members.length})`, members.length === 2);

    /*
     * Start from no session, and leave none behind.
     *
     * One session exists per space, so a session left over by an interrupted
     * run is not old data to run on top of — it is the SAME slot this run
     * needs, and it points the wrong way: the previous run's host is this
     * run's guest, so the invite button starts out disabled behind an invite
     * modal of its own and the run measures nothing. (Repeated
     * invite/decline cycles are covered where they belong, in
     * tests/api/listen-session.test.ts, which asserts each invite gets a new
     * id precisely because a reused one broke the second decline.)
     */
    await db.collection("listensessions").deleteMany({ spaceId });

    await guest.goto(`${base}/library`);
    await host.goto(`${base}/library`);
    const inviteButton = await host
      .until(`!!document.querySelector('[aria-label^="Rủ "]')`, { timeout: 60000 })
      .then(() => true)
      .catch(() => false);
    ok("thẻ nhạc có nút rủ nghe cùng", inviteButton);
    if (!inviteButton) return results;

    // ── The host asks ─────────────────────────────────────────────────────
    const asked0 = await host.eval(`(() => {
      const b = document.querySelector('[aria-label^="Rủ "]');
      if (!b || b.disabled) return false;
      b.click();
      return true;
    })()`);
    ok("nút rủ bấm được (không bị khoá bởi phiên cũ)", asked0);
    const waiting = await host
      .until(hasText("Đang chờ"), { timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    ok("bên rủ hiện trạng thái đang chờ trả lời", waiting);

    /*
     * The important one. While the invite is unanswered the host's player
     * must be paused — the transport button reads "Phát", not "Tạm dừng".
     */
    const hostPaused = await host.eval(
      `!!document.querySelector('[aria-label="Phát"]') && !document.querySelector('[aria-label="Tạm dừng"]')`,
    );
    ok("bên rủ chưa chạy bài khi bên kia chưa đồng ý", hostPaused);

    // ── The guest is asked ────────────────────────────────────────────────
    const asked = await guest
      .until(hasText("Nghe cùng nhau nha"), { timeout: 40000 })
      .then(() => true)
      .catch(() => false);
    if (!asked) {
      // Say what the other side WAS showing — a suite that only says "no"
      // sends you back to the browser to find out what it meant.
      const seen = await guest.eval(
        `JSON.stringify({ path: location.pathname, cookie: document.cookie.match(/active_space_id=[^;]*/)?.[0] ?? "none", cards: document.querySelectorAll('[aria-label^="Phát "]').length, invite: document.querySelectorAll('[aria-label^="Rủ "]').length, text: document.body.innerText.replace(/\\s+/g, " ").slice(0, 160) })`,
      );
      ok("bên kia nhận được lời mời", false, seen);
      if (shotDir) await guest.shot(`${shotDir}/listen-invite-missing.png`);
      return results;
    }
    ok("bên kia nhận được lời mời", asked);
    if (shotDir) await guest.shot(`${shotDir}/listen-invite.png`);

    // Still held, now that the invite has definitely been delivered.
    ok(
      "vẫn chưa chạy bài trong lúc lời mời còn treo",
      await host.eval(`!document.querySelector('[aria-label="Tạm dừng"]')`),
    );

    // ── The guest accepts ─────────────────────────────────────────────────
    const accepted = await guest.eval(clickInCard("Nghe cùng nhau nha", "Nghe cùng"));
    ok("bấm được nút nghe cùng trong hộp thoại", accepted === "clicked", accepted);
    const guestOnWatch = await guest
      .until(`location.pathname.startsWith('/library/phat/') && !!document.querySelector('[data-watch-slot]')`, {
        timeout: 40000,
      })
      .then(() => true)
      .catch(() => false);
    ok("đồng ý xong là vào thẳng trang phát khung lớn", guestOnWatch);

    const live = await host
      .until(hasText("Đang nghe cùng"), { timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    ok("bên rủ thấy phiên đã bắt đầu", live);

    // ── A skip is a skip, not a change of window ──────────────────────────
    const guestBefore = await guest.eval(`location.pathname`);
    const hostHadSlot = await host.eval(`!!document.querySelector('[data-watch-slot]')`);
    const skipped = await host.eval(`(() => {
      const b = document.querySelector('[aria-label="Bài sau"]');
      if (!b) return false;
      b.click();
      return true;
    })()`);
    ok("bấm được bài sau ở bên rủ", skipped);

    const guestFollowed = await guest
      .until(`location.pathname !== ${JSON.stringify(guestBefore)}`, { timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    ok("bên kia đổi bài theo", guestFollowed);
    ok(
      "bên kia vẫn ở khung lớn sau khi đổi bài",
      await guest.eval(`!!document.querySelector('[data-watch-slot]')`),
    );
    ok(
      "bên rủ không bị đổi khung sau khi đổi bài",
      (await host.eval(`!!document.querySelector('[data-watch-slot]')`)) === hostHadSlot,
    );

    // ── Ending it ends it for both ────────────────────────────────────────
    ok("dừng được phiên", await host.eval(clickText("Dừng")));
    const guestEnded = await guest
      .until(`!${hasText("Đang nghe cùng")}`, { timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    ok("bên kia thấy phiên đã dừng", guestEnded);
    if (shotDir) await host.shot(`${shotDir}/listen-host-end.png`);
  } finally {
    // Never hand the next run a half-finished session.
    await db.collection("listensessions").deleteMany({}).catch(() => {});
    host.close();
    guest.close();
    hostChrome.kill();
    guestChrome.kill();
  }
  return results;
}
