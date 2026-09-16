/*
 * The invite link, end to end, through a real browser.
 *
 * The part worth automating is not the happy path — it is the four ways this
 * ends badly, because they all used to show the same sentence, and three of
 * them were wrong. And the one crossing that no API test can reach: opening a
 * link with NO account, signing up, and arriving inside the space that invited
 * you rather than in a fresh empty one of your own.
 *
 * That last one had a real trap in it: SpaceGuard reads any page it does not
 * recognise as "needs a couple space", sees a brand-new account with none, and
 * replaces the page with /onboarding — throwing the invitation away at the
 * exact moment it was about to be accepted.
 *
 * No external API is called. Places are written straight to Mongo and the
 * route endpoint is blocked, as in the other suites.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Lời mời: QR, đường liên kết, và bốn ngã rẽ";

const PASSWORD = "e2e-local-password";

/** A brand-new person, created through the real sign-up form. */
async function signUpFresh(page, base, email, name) {
  const body = JSON.stringify({ name, email, password: PASSWORD });
  return page.eval(`(async () => {
    const h = { "content-type": "application/json" };
    const r = await fetch("/api/auth/sign-up/email", { method: "POST", headers: h, body: ${JSON.stringify(body)} });
    if (r.status === 200) return "signed-up";
    const i = await fetch("/api/auth/sign-in/email", { method: "POST", headers: h, body: ${JSON.stringify(body)} });
    return i.status === 200 ? "signed-in" : "failed";
  })()`);
}

export async function run({ base, profileDir, port, db, shotDir }) {
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });

  const host = await launchChrome(`${profileDir}-host`, port, { width: 430, height: 930 });
  const H = await openPage(port);
  /*
   * `port + 100`, not `port + 1`.
   *
   * The runner hands each suite the next port in sequence, so a suite that
   * quietly takes the one after its own is standing on whatever runs next —
   * and the symptom is a Chrome that will not open its debugging port, three
   * suites later, for no visible reason. The jump is 100 rather than a few,
   * because another session on this machine drives Chrome from 9481 and a
   * second browser landing there fails just as opaquely.
   */
  const guest = await launchChrome(`${profileDir}-guest`, port + 100, { width: 430, height: 930 });
  const G = await openPage(port + 100);

  let spaceId = null;
  /** Exactly how the shared space looked before this suite touched it. */
  let originalMembers = null;
  const guestEmail = `e2e-invite-${Date.now()}@example.com`;

  try {
    for (const p of [H, G]) {
      await p.viewport(430, 930, true);
      await p.send("Network.enable");
      await p.send("Network.setBlockedURLs", { urls: ["*location.getRoute*"] });
    }
    /*
     * The guest must arrive as a STRANGER, and Chrome profiles outlive a run.
     * Without this the second run reuses the account the first one created —
     * which was removed from the space in the meantime — so the page under
     * test renders "this invite is spent" instead of the signed-out screen
     * that is the whole point of the check. The suite passed once and then
     * never again, which is the worst kind of green.
     */
    await G.send("Network.clearBrowserCookies");
    await G.eval(`try { localStorage.clear(); sessionStorage.clear(); } catch {}`).catch(() => {});

    /* ——— the host makes an invitation ————————————————————————— */
    const me = await signIn(H, base, db);
    spaceId = me.spaceId;
    /*
     * This suite borrows the shared E2E space and must give it back unchanged.
     *
     * It needs room for a third person, so it empties the membership down to
     * the host — and the listen and watch suites assert that same space holds
     * exactly two. Remembering the original list is what lets the `finally`
     * put it back rather than leaving a space nobody else can use.
     */
    const { ObjectId } = await import("mongodb");
    const before = await db.collection("spaces").findOne({ _id: ObjectId.createFromHexString(spaceId) });
    originalMembers = before?.members ?? null;
    await db.collection("spaces").updateOne(
      { _id: ObjectId.createFromHexString(spaceId) },
      { $set: { members: [me.uid] }, $unset: { inviteCodeHash: "", inviteCodeExpiresAt: "" } },
    );

    await H.goto(`${base}/settings`);
    await H.until(`document.body.innerText.includes("Mời người đồng hành")`, { timeout: 60000 });
    await H.eval(`[...document.querySelectorAll('button')].find(b => /Tạo lời mời/.test(b.textContent||''))?.click()`);
    const drawn = await H.until(
      `!!document.querySelector('svg[aria-label="Mã QR mời vào không gian"] path')`,
      { timeout: 30000 },
    ).then(() => true).catch(() => false);
    ok("bấm Tạo lời mời là hiện mã QR", drawn);

    const qr = JSON.parse(await H.eval(`(() => {
      const svg = document.querySelector('svg[aria-label="Mã QR mời vào không gian"]');
      const path = svg?.querySelector('path');
      const link = [...document.querySelectorAll('button')].map(b => (b.textContent||'').trim())
        .find(t => /\\/moi\\//.test(t));
      return JSON.stringify({
        paths: svg ? svg.querySelectorAll('path').length : 0,
        rects: svg ? svg.querySelectorAll('rect').length : 0,
        dLength: path?.getAttribute('d')?.length ?? 0,
        link: link ?? null,
        hasCopy: !!document.querySelector('[aria-label="Chép đường liên kết"]'),
      });
    })()`));
    ok("mã QR là MỘT thẻ path, không phải hàng trăm rect",
      qr.paths === 1 && qr.rects === 0, `path=${qr.paths} rect=${qr.rects}`);
    ok("và nó có hình thật (đường vẽ đủ dài)", qr.dLength > 1000, `d dài ${qr.dLength}`);
    ok("đường liên kết hiện đầy đủ để người ta xem trước khi gửi", !!qr.link, qr.link ?? "");
    ok("có nút chép", qr.hasCopy === true);

    /*
     * Đo tràn ngang NGAY LÚC NÀY, không đợi cuối bộ kiểm.
     *
     * Đường liên kết mời là chuỗi không xuống dòng được đầu tiên mà trang cài
     * đặt từng hiển thị, nên nó chỉ tồn tại sau khi bấm "Tạo lời mời". Cả bộ
     * kiểm này lẫn bộ bên cạnh đều chụp /settings TRƯỚC khi bấm — tức đúng lúc
     * chưa có gì để vỡ — nên một trang tràn 56px ở 390px đi lọt tới tận khi
     * chủ repo tự thấy trên điện thoại.
     */
    for (const [w, h] of [[390, 844], [430, 930]]) {
      await H.send("Emulation.setDeviceMetricsOverride", {
        width: w, height: h, deviceScaleFactor: 2, mobile: true,
      });
      await new Promise((r) => setTimeout(r, 400));
      const spill = await H.horizontalOverflow();
      ok(`bảng mời ở ${w}px (đang mở mã QR): không tràn ngang`, spill === null, spill ?? "");
      if (shotDir) {
        await H.eval(`document.querySelector('svg[aria-label="Mã QR mời vào không gian"]')
          ?.closest('div')?.parentElement?.scrollIntoView({ block: 'center' })`);
        await new Promise((r) => setTimeout(r, 300));
        await H.shot(`${shotDir}/invite-panel-${w}.png`);
      }
    }
    await H.send("Emulation.setDeviceMetricsOverride",
      { width: 430, height: 930, deviceScaleFactor: 2, mobile: true });

    if (shotDir) {
      // The panel sits well down a long settings page; a screenshot of the top
      // of that page tells nobody anything about it.
      await H.eval(`document.querySelector('svg[aria-label="Mã QR mời vào không gian"]')
        ?.closest('div')?.parentElement?.scrollIntoView({ block: 'center' })`);
      await new Promise((r) => setTimeout(r, 400));
      await H.shot(`${shotDir}/invite-panel.png`);
    }

    const row = await db.collection("spaces").findOne(
      { _id: (await import("mongodb")).ObjectId.createFromHexString(spaceId) },
    );
    ok("mã mời đã được ghi vào không gian", !!row?.inviteCodeHash);
    const link = qr.link;
    if (!link) return results;

    /*
     * The status code, before anything about what is on screen.
     *
     * This page once answered HTTP 500 to every request while looking
     * perfectly correct in a browser: `useSession` cannot be server-rendered
     * in this app, and in development Next rebuilds the page on the client
     * after the server throws. So a check that reads the text passed, and a
     * link opened from Zalo showed an error page. Reading the text is not
     * reading the response.
     */
    for (const [path, what] of [
      [`/moi/${link.split("/moi/")[1]}`, "mã thật"],
      ["/moi/KHONGCOTHAT", "mã bịa"],
    ]) {
      const status = await H.eval(
        `fetch(${JSON.stringify(path)}, { redirect: "manual" }).then(r => r.status)`,
      );
      ok(`trang mời trả 200 cho ${what}, không phải lỗi máy chủ`, status === 200, `HTTP ${status}`);
    }

    /* ——— ngã rẽ 1: chưa đăng nhập thì phải biết được mời vào ĐÂU ——— */
    await G.goto(link);
    /*
     * Khớp KHÔNG phân biệt hoa thường: dòng nhãn đó nay là eyebrow chữ hoa
     * (`uppercase`), mà `innerText` trả về chữ ĐÃ biến đổi theo CSS — nên phép
     * so khớp đúng-từng-chữ vỡ ngay lúc đổi kiểu chữ, dù màn hình vẫn đúng.
     */
    await G.until(
      `/bạn được mời vào/i.test(document.body.innerText)`,
      { timeout: 60000 },
    );
    const invited = JSON.parse(await G.eval(`(() => {
      const t = document.body.innerText;
      return JSON.stringify({
        namesSpace: /E2E/.test(t),
        offersSignUp: [...document.querySelectorAll('a')].some(a => /Tạo tài khoản/.test(a.textContent||'')),
        offersSignIn: [...document.querySelectorAll('a')].some(a => /Đăng nhập/.test(a.textContent||'')),
        saysOnce: /một lần/.test(t),
      });
    })()`));
    ok("người chưa có tài khoản thấy tên không gian mời mình", invited.namesSpace);
    ok("…và có lối tạo tài khoản", invited.offersSignUp);
    ok("…và lối đăng nhập nếu đã có", invited.offersSignIn);
    ok("…và biết lời mời dùng một lần", invited.saysOnce);
    if (shotDir) await G.shot(`${shotDir}/invite-signed-out.png`);

    /* ——— đăng ký xong phải vào ĐÚNG không gian đó ————————————— */
    await G.eval(`[...document.querySelectorAll('a')].find(a => /Tạo tài khoản/.test(a.textContent||''))?.click()`);
    await G.until(`location.pathname === "/sign-up"`, { timeout: 30000 });
    const carried = await G.eval(`new URLSearchParams(location.search).get("moi")`);
    ok("mã mời đi theo sang trang đăng ký", !!carried, `moi=${carried}`);

    const outcome = await signUpFresh(G, base, guestEmail, "Người Được Mời");
    ok("tạo được tài khoản mới", outcome === "signed-up", outcome);
    await G.eval(`localStorage.setItem("dwy:welcomeSeen","1")`);
    await G.goto(`${base}/moi/${carried}`);
    const joined = await G.until(
      `/Xong rồi|Bạn đã ở trong không gian/.test(document.body.innerText)`,
      { timeout: 60000 },
    ).then(() => true).catch(() => false);
    ok("người mới đăng ký xong thì vào thẳng không gian được mời", joined);
    if (shotDir) await G.shot(`${shotDir}/invite-joined.png`);

    const after = await db.collection("spaces").findOne(
      { _id: (await import("mongodb")).ObjectId.createFromHexString(spaceId) },
    );
    ok("và trong DB họ đã là thành viên", (after?.members?.length ?? 0) === 2,
      `members=${after?.members?.length}`);
    ok("KHÔNG bị đá sang onboarding giữa chừng",
      !(await G.eval(`location.pathname`)).startsWith("/onboarding"));
    const cookieSet = await G.eval(`document.cookie.includes("active_space_id=${spaceId}")`);
    ok("và không gian đang dùng đã trỏ đúng chỗ vừa vào", cookieSet === true);

    /* ——— ngã rẽ 2: mở lại chính link đó ————————————————————— */
    await G.goto(link);
    const reused = await G.until(
      `/đã được dùng|không còn dùng được|đã ở trong không gian/i.test(document.body.innerText)`,
      { timeout: 60000 },
    ).then(() => true).catch(() => false);
    ok("mở lại link cũ thì được báo rõ, không im lặng", reused);
    if (shotDir) await G.shot(`${shotDir}/invite-reused.png`);

    /* ——— ngã rẽ 2b: thành viên mở mã CÒN SỐNG của chính không gian mình ———
     *
     * Chỗ này từng nói hai câu ngược nhau trên cùng một màn: thẻ ghi "Không
     * gian đã đủ hai người" (kèm nút Về trang chủ) trong khi toast dưới nó ghi
     * "Bạn đã ở trong không gian này rồi". Lý do: `previewInvite` là
     * publicProcedure — chạy không có phiên nên chỉ thấy không gian có 2 người,
     * không thấy người đang đọc màn CHÍNH LÀ một trong hai; còn `joinByCode`
     * thì biết, và màn lại tin cái đoán thay vì tin sự thật.
     *
     * Bài trên ("mở lại link cũ") không bắt được vì nó khẳng định bằng phép
     * HOẶC ba câu, nên câu nào hiện cũng xanh. Bài này khẳng định cả hai chiều:
     * phải nói đúng câu này, và phải KHÔNG nói câu kia.
     */
    const { createHash: sha } = await import("node:crypto");
    const { ObjectId: OID } = await import("mongodb");
    await db.collection("spaces").updateOne(
      { _id: OID.createFromHexString(spaceId) },
      { $set: { inviteCodeHash: sha("sha256").update("CONSONGNHE").digest("hex"),
                inviteCodeExpiresAt: new Date(Date.now() + 6 * 86400000) } },
    );
    await H.goto(`${base}/moi/CONSONGNHE`);
    await H.until(
      `/đã ở trong không gian|đủ hai người|đủ 2 người/i.test(document.body.innerText)`,
      { timeout: 60000 },
    ).catch(() => {});
    const own = JSON.parse(await H.eval(`(() => {
      const t = document.body.innerText;
      return JSON.stringify({
        saysMember: /đã ở trong không gian/i.test(t),
        saysFull:   /đủ hai người|đủ 2 người/i.test(t),
        action:     [...document.querySelectorAll('a')].map(a => a.textContent.trim()).join("|"),
      });
    })()`));
    ok("thành viên mở mã của chính mình được báo ĐÚNG là đã ở trong", own.saysMember === true);
    ok("…và KHÔNG bị báo nhầm là không gian đã đủ người", own.saysFull === false,
      `màn nói: ${own.action}`);
    ok("…và nút dẫn vào ứng dụng, không đá về trang chủ",
      /Mở ứng dụng/.test(own.action), own.action);
    if (shotDir) await H.shot(`${shotDir}/invite-already-member.png`);

    /* ——— ngã rẽ 3: link hết hạn ————————————————————————————— */
    await H.goto(`${base}/settings`);
    await H.until(`document.body.innerText.includes("Mời người đồng hành")`, { timeout: 60000 });
    const full = await H.eval(`/đủ 2 người|đủ hai người/.test(document.body.innerText)`);
    ok("không gian đã đủ người thì không mời thêm được", full === true);

    // A fresh space, so an expiry can be forced without disturbing the pair.
    const other = await db.collection("spaces").insertOne({
      name: "Góc hết hạn", members: [me.uid], themePreset: "terracotta", createdBy: me.uid,
      isPersonal: false, memberProfiles: [], tags: [], createdAt: new Date(), updatedAt: new Date(),
      inviteCodeHash: (await import("node:crypto")).createHash("sha256").update("EXPIREDCODE").digest("hex"),
      inviteCodeExpiresAt: new Date(Date.now() - 60_000),
    });
    await G.goto(`${base}/moi/EXPIREDCODE`);
    const expired = await G.until(
      `/hết hạn/.test(document.body.innerText)`, { timeout: 60000 },
    ).then(() => true).catch(() => false);
    ok("link quá hạn báo ĐÚNG là hết hạn", expired);
    const tellsWhatToDo = await G.eval(`/tạo lời mời mới|tạo mã mới/i.test(document.body.innerText)`);
    ok("…và bảo người ta phải làm gì tiếp", tellsWhatToDo === true);
    if (shotDir) await G.shot(`${shotDir}/invite-expired.png`);
    await db.collection("spaces").deleteOne({ _id: other.insertedId });

    /* ——— ngã rẽ 4: link bịa ———————————————————————————————— */
    await G.goto(`${base}/moi/KHONGCOTHAT`);
    const bogus = await G.until(
      `/không còn dùng được|hết hạn/.test(document.body.innerText)`, { timeout: 60000 },
    ).then(() => true).catch(() => false);
    ok("link không có thật cũng được giải thích tử tế", bogus);

    /* ——— UI ở nhiều khổ màn ————————————————————————————————— */
    for (const [w, h] of [[390, 844], [430, 930], [768, 1024], [1280, 900]]) {
      await G.send("Emulation.setDeviceMetricsOverride", {
        width: w, height: h, deviceScaleFactor: w < 500 ? 2 : 1, mobile: w < 500,
      });
      await G.goto(link);
      await G.until(`document.readyState === "complete"`, { timeout: 30000 }).catch(() => {});
      /*
       * `documentElement.scrollWidth <= innerWidth` là phép kiểm SAI trong app
       * này và nó im lặng suốt: PageShell lồng cái cuộn thật vào bên trong,
       * nên documentElement không bao giờ rộng ra — một trang tràn 56px vẫn
       * xanh. `horizontalOverflow()` tìm đúng hộp đang cuộn và gọi tên phần tử
       * rộng nhất bên trong nó.
       */
      const overflow = await G.horizontalOverflow();
      ok(`màn ${w}px: không tràn ngang`, overflow === null, overflow ?? "");

      /*
       * Tấm thẻ phải CÓ MÉP.
       *
       * "Không tràn ngang" là kiểm bố cục, không phải kiểm nhìn được hay
       * không — và bản trước qua hết bốn khổ màn trong khi thẻ trắng viền
       * #E5E7EB nằm trên ảnh nền đo được 1.11:1 ở giữa chu vi, 45% số điểm
       * dưới 1.20:1 (tức mắt máy không tìm thấy mép). Đo lại sau khi sửa:
       * trung vị 1.78:1, 0% dưới 1.20:1.
       *
       * Đếm pixel thì phải giải mã PNG trong Node, nên chỗ này chốt thứ tạo
       * ra con số đó: các lớp bóng. Ai dọn dẹp mà bỏ `floating` đi thì bài này
       * đỏ, kèm lý do ngay đây.
       *
       * Cố ý KHÔNG chờ trạng thái cuối: đo đúng cái đang hiện. Nhờ vậy nó bắt
       * được khung chờ của `dynamic()` — một bản chép tay không có bóng, và là
       * thứ người ta nhìn thấy ĐẦU TIÊN khi mở link.
       */
      const surface = JSON.parse(await G.eval(`(() => {
        const el = document.querySelector('main > div.bg-card');
        if (!el) return JSON.stringify({ found: false });
        const cs = getComputedStyle(el);
        const alphaOf = (c) => {
          const m = /^rgba?\\(([^)]*)\\)/.exec(c.trim());
          if (!m) return 0;
          const parts = m[1].split(",").map((v) => parseFloat(v));
          return parts.length === 4 ? parts[3] : 0;
        };
        const layers = (cs.boxShadow.match(/rgba?\\([^)]*\\)[^,]*/g) || []);
        const alphas = layers.map((l) => alphaOf(l));
        // Lớp toả đều (offset 0 0) là lớp DUY NHẤT với tới cạnh trên; đo từng
        // cạnh cho thấy nếu thiếu nó thì cạnh trên chỉ còn 1.42:1 trong khi
        // cạnh dưới 2.32:1. Nên chốt riêng sự tồn tại của nó, không chỉ chốt
        // alpha lớn nhất — bỏ đúng lớp đó đi thì alpha lớn nhất vẫn nguyên.
        const hasHalo = layers.some((l) => /\\)\\s+0px\\s+0px\\s/.test(l) && alphaOf(l) >= 0.12);
        return JSON.stringify({ found: true, hasHalo,
          maxShadowAlpha: alphas.length ? Math.max(...alphas) : 0,
          // Bài kiểm trượt mà chỉ nói "0" thì không sửa được: in luôn chuỗi
          // thật để biết là thiếu lớp, hay là CSS chưa nạp.
          raw: cs.boxShadow.slice(0, 120),
          cls: (el.className || "").toString().slice(0, 80) });
      })()`));
      ok(`màn ${w}px: tìm thấy tấm thẻ`, surface.found === true);
      ok(`màn ${w}px: bóng đủ đậm để thấy mép trên ảnh nền`,
        surface.maxShadowAlpha >= 0.2,
        surface.maxShadowAlpha >= 0.2 ? "" :
          `alpha lớn nhất ${surface.maxShadowAlpha} — boxShadow="${surface.raw}" class="${surface.cls}"`);
      ok(`màn ${w}px: có lớp toả đều để cạnh TRÊN cũng có mép`,
        surface.hasHalo === true, surface.hasHalo ? "" : `boxShadow="${surface.raw}"`);

      if (shotDir) await G.shot(`${shotDir}/invite-${w}.png`);
    }

    /* ——— khổ màn của bảng mời bên người mời ————————————————— */
    for (const [w, h] of [[390, 844], [1280, 900]]) {
      await H.send("Emulation.setDeviceMetricsOverride", {
        width: w, height: h, deviceScaleFactor: w < 500 ? 2 : 1, mobile: w < 500,
      });
      await H.goto(`${base}/settings`);
      await H.until(`document.body.innerText.includes("Mời người đồng hành")`, { timeout: 60000 });
      const settingsOverflow = await H.horizontalOverflow();
      ok(`cài đặt ${w}px: không tràn ngang`, settingsOverflow === null, settingsOverflow ?? "");
      if (shotDir) {
        await H.eval(`[...document.querySelectorAll('p,button')]
          .find(e => /Mời người đồng hành|Tạo lời mời/.test(e.textContent||''))
          ?.scrollIntoView({ block: 'center' })`);
        await new Promise((r) => setTimeout(r, 400));
        await H.shot(`${shotDir}/invite-settings-${w}.png`);
      }
    }
  } finally {
    /*
     * Put the space back to how it was found.
     *
     * This suite adds a third person to the shared E2E space, and the listen
     * and watch suites assert that space holds exactly two. Leaving the guest
     * behind made THEM fail on the next run — a test that breaks its
     * neighbours is worse than one that fails itself, because the failure
     * lands somewhere with no obvious connection to the cause.
     */
    await db.collection("user").deleteMany({ email: guestEmail }).catch(() => {});
    if (spaceId && originalMembers) {
      const { ObjectId } = await import("mongodb");
      await db.collection("spaces").updateOne(
        { _id: ObjectId.createFromHexString(spaceId) },
        {
          $set: { members: originalMembers },
          $unset: { inviteCodeHash: "", inviteCodeExpiresAt: "" },
        },
      ).catch(() => {});
    }
    H.close(); G.close(); host.kill(); guest.kill();
  }
  return results;
}
