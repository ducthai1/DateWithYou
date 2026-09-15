/*
 * Từ lúc chưa có tài khoản tới lúc đứng trong một không gian.
 *
 * Phần này chưa từng được đi thử bằng FORM THẬT — bộ `invite` đi tắt bằng
 * `fetch("/api/auth/sign-up/email")`, nên nó không bao giờ chạm vào màn hình
 * onboarding, và ba lỗi dưới đây sống sót qua mọi lần chạy xanh:
 *
 *   · hộp thoại "Chào mừng tới Vivu No Plan" phủ kín /onboarding. Đăng ký xong
 *     rơi vào /home ⇒ WelcomeIntro mở ra, rồi SpaceGuard thấy tài khoản chưa có
 *     không gian nên thay route bằng /onboarding — hộp thoại vẫn đứng đó. Màn
 *     hình ĐẦU TIÊN của một người mới là bảng chú thích bảy thẻ họ chưa vào
 *     được, đè lên đúng cái form cấp cho họ quyền vào.
 *   · ô "Nhập mã mời" gộp cả bốn kiểu hỏng thành "Không tham gia được, thử lại
 *     nhé" — sai với ba trong bốn. Người vào một không gian đã đủ hai người
 *     được bảo là thử lại, mãi mãi.
 *   · tạo/tham gia xong thì rơi vào /settings, ở ĐẦU một trang cài đặt rất dài,
 *     trong khi nhận lời mời qua link thì lại về /home.
 *
 * Nên bộ này đi bằng chuột và bàn phím thật: gõ vào ô, bấm nút, đọc chữ hiện ra.
 * Và nó đọc CẢ MÃ TRẠNG THÁI HTTP, không chỉ chữ trên màn hình — dev server của
 * Next dựng lại trang trên client sau khi server ném lỗi, nên một trang 500 vẫn
 * trông hoàn toàn bình thường trong ảnh chụp.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";

export const name = "Người mới: đăng ký → onboarding → tạo hoặc tham gia";

const PASSWORD = "e2e-local-password";
/** Trùng POST_LOGIN_REDIRECT trong nav-items.ts — một cửa vào duy nhất. */
const FRONT_DOOR = "/home";
const hashCode = (c) => createHash("sha256").update(c.trim().toUpperCase()).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FILL = (sel, val) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return "no-el";
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, ${JSON.stringify(val)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return "ok";
})()`;

/** Bấm nút/liên kết theo CHỮ, khớp chính xác — "Tiếp tục" cũng khớp "Tiếp tục với Google". */
const CLICK = (re, { last = false } = {}) => `(() => {
  const all = [...document.querySelectorAll("button,a")].filter(e => ${re}.test((e.textContent||"").trim()));
  const el = ${last} ? all[all.length - 1] : all[0];
  if (!el) return "no-el";
  el.click();
  return "ok";
})()`;

/*
 * Chờ tới khi React thật sự cầm trang, rồi mới chọn giới tính.
 *
 * Trước khi hydrate xong, mọi thao tác đều rơi vào hư không: `gender` là state
 * của React nên cú bấm radio không tới đâu, còn ba ô chữ thì giữ giá trị trong
 * DOM nhưng state vẫn rỗng. Bấm "Đăng ký" lúc đó cho ra đúng cái màn hình khó
 * hiểu nhất: các ô đều có chữ, mà app báo "Chọn Nam hoặc Nữ".
 *
 * Phép thử phải hỏi ĐÚNG cái label của radio vừa bấm. Bản đầu hỏi "có label nào
 * mang lớp border-accent không" — các ô Input cũng dùng lớp đó khi đang focus,
 * nên nó trả lời "rồi" trong lúc React còn chưa gắn gì, và bộ kiểm hỏng ngẫu
 * nhiên mỗi lần dev server phải biên dịch lại.
 */
async function waitHydrated(page, gender = "female") {
  const picked = `(() => {
    const el = document.querySelector('input[name="gender"][value="${gender}"]');
    const label = el?.closest("label");
    return !!label && (label.className || "").includes("border-accent");
  })()`;
  for (let i = 0; i < 60; i++) {
    await page.eval(`document.querySelector('input[name="gender"][value="${gender}"]')?.click()`).catch(() => {});
    await sleep(400);
    if (await page.eval(picked).catch(() => false)) return true;
  }
  return false;
}

/** Bấm cho tới khi trang nhúc nhích — xem waitHydrated để biết vì sao cần. */
async function clickUntil(page, clickExpr, condition, { tries = 20, gap = 1000 } = {}) {
  for (let i = 0; i < tries; i++) {
    await page.eval(clickExpr).catch(() => {});
    for (let j = 0; j < Math.round(gap / 200); j++) {
      await sleep(200);
      try {
        if (await page.eval(condition)) return true;
      } catch {
        /* đang điều hướng, tính là nhúc nhích */
      }
    }
  }
  return false;
}


/*
 * Gõ vào ô, rồi đợi React thừa nhận là đã gõ.
 *
 * Cả hai nút của onboarding đều `disabled={!giá_trị.trim()}`, nên nút mở khoá
 * chính là bằng chứng state đã nhận — và khi trang chưa hydrate thì ô có chữ
 * còn nút vẫn khoá, bấm bao nhiêu lần cũng không có gì xảy ra. Đó là lý do lần
 * thử mã đầu tiên từng "im lặng" trong khi những lần sau đều báo lỗi đàng hoàng.
 */
async function typeAndWait(page, value, buttonRe) {
  const enabled = `(() => {
    const all = [...document.querySelectorAll("button")].filter(b => ${buttonRe}.test((b.textContent||"").trim()));
    const b = all[all.length - 1];
    return !!b && !b.disabled;
  })()`;
  for (let i = 0; i < 30; i++) {
    await page.eval(FILL("input", value)).catch(() => {});
    await sleep(300);
    if (await page.eval(enabled).catch(() => false)) return true;
  }
  return false;
}

/** Đăng ký bằng đúng cái form người dùng thấy, không gọi thẳng API. */
async function signUpThroughForm(page, base, { name, email, gender = "female", query = "" }) {
  await page.goto(`${base}/sign-up${query}`);
  await page.until(`!!document.querySelector('input[name="email"]')`, { timeout: 90000 });
  for (let attempt = 0; attempt < 4; attempt++) {
    if (!(await waitHydrated(page, gender))) continue;
    await page.eval(FILL('input[name="name"]', name));
    await page.eval(FILL('input[name="email"]', email));
    await page.eval(FILL('input[name="password"]', PASSWORD));
    await sleep(300);
    await clickUntil(
      page,
      CLICK("/^Đăng ký$/"),
      `location.pathname !== "/sign-up" || /Đang xử lý/.test(document.body.innerText)`,
    );
    await page.until(`location.pathname !== "/sign-up"`, { timeout: 60000 }).catch(() => {});
    await sleep(1500);
    if ((await page.eval(`location.pathname`)) !== "/sign-up") return;
    // Vẫn đứng nguyên: nạp lại rồi thử lượt nữa. Dev server biên dịch lần đầu
    // mất vài giây, và trong lúc đó trang chưa nhận thao tác nào.
    await page.goto(`${base}/sign-up${query}`);
    await page.until(`!!document.querySelector('input[name="email"]')`, { timeout: 90000 });
  }
  return page.eval(`(() => {
    const el = [...document.querySelectorAll("p")].find(p => (p.className||"").includes("text-destructive"));
    return el ? el.textContent.trim() : "không báo gì";
  })()`);
}

const hasWelcome = `/Chào mừng tới Vivu No Plan/.test(document.body.innerText)`;
const errorText = `(() => {
  const el = [...document.querySelectorAll("p")].find(p => (p.className||"").includes("text-destructive"));
  return el ? el.textContent.trim() : null;
})()`;

export async function run({ base, profileDir, port, db, shotDir }) {
  const results = [];
  const ok = (label, pass, detail = "") => results.push({ ok: pass, name: label, detail });
  const stamp = Date.now();
  const emails = [];
  const spaceIds = [];
  const ghost = new ObjectId().toString();
  const ghost2 = new ObjectId().toString();

  const seedSpace = async (name, members, code, expiresAt) => {
    const r = await db.collection("spaces").insertOne({
      name,
      members,
      themePreset: "terracotta",
      createdBy: members[0],
      isPersonal: false,
      memberProfiles: [],
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(code ? { inviteCodeHash: hashCode(code), inviteCodeExpiresAt: expiresAt ?? new Date(Date.now() + 6 * 864e5) } : {}),
    });
    spaceIds.push(r.insertedId);
    return String(r.insertedId);
  };

  const chrome = await launchChrome(profileDir, port, { width: 390, height: 844 });
  const P = await openPage(port);

  try {
    await P.viewport(390, 844, true, 2);
    await P.send("Network.enable");
    await P.send("Network.setBlockedURLs", { urls: ["*location.getRoute*", "*location.geocode*"] });

    /* ─── Trang nào cũng phải 200 từ SERVER ────────────────────────────
     * Không phải thừa: /moi/[code] từng trả 500 ở mọi request vì một hook
     * chỉ chạy được ở client bị render trên server, mà trên màn hình thì
     * không thấy gì khác lạ — dev server dựng lại trang ở client. Chỉ mã
     * trạng thái nói thật.
     */
    for (const path of ["/sign-up", "/sign-in", "/onboarding"]) {
      const r = await fetch(`${base}${path}`, { redirect: "manual" }).catch(() => null);
      ok(`${path} không lỗi máy chủ`, !!r && r.status < 500, r ? `HTTP ${r.status}` : "không nối được");
    }

    /*
     * Một lượt mở /sign-up bỏ đi trước khi đo.
     *
     * Lần đầu vào một route, dev server còn phải biên dịch gói client, và
     * trang đứng đó không nhận thao tác nào. Không hâm trước thì người dùng
     * ĐẦU TIÊN của mỗi lần chạy hỏng, những người sau thì không — đúng kiểu
     * đỏ ngẫu nhiên khiến người ta thôi tin bộ kiểm.
     */
    await P.goto(`${base}/sign-up`);
    await P.until(`!!document.querySelector('input[name="email"]')`, { timeout: 90000 }).catch(() => {});
    await waitHydrated(P);

    /* ─── A. Đăng ký → onboarding → TẠO không gian ─────────────────── */
    await P.send("Network.clearBrowserCookies");
    await P.goto(`${base}/`);
    await P.eval(`try { localStorage.clear(); sessionStorage.clear(); } catch {}`).catch(() => {});

    const emailA = `e2e-onb-a-${stamp}@example.com`;
    emails.push(emailA);
    const whyA = await signUpThroughForm(P, base, { name: "Người Mới A", email: emailA });

    /*
     * Đăng ký xong thì trình duyệt đi tới POST_LOGIN_REDIRECT trước đã; chỉ sau
     * một lượt hỏi `space.getMine` thì SpaceGuard mới biết tài khoản này chưa có
     * không gian và thay route bằng /onboarding. Đọc ngay lúc vừa tới sẽ thấy
     * /home và kết luận sai — phải đợi route đứng yên rồi mới nói.
     */
    await P.until(`location.pathname === "/onboarding"`, { timeout: 30000 }).catch(() => {});
    const landed = await P.eval(`location.pathname`);
    ok(
      "đăng ký xong, người chưa có không gian được đưa tới /onboarding",
      landed === "/onboarding",
      landed === "/onboarding" ? "" : `${landed}${whyA ? ` — màn hình nói: ${whyA}` : ""}`,
    );

    await sleep(1200);
    const covered = await P.eval(hasWelcome);
    ok(
      "…và hộp thoại chào mừng KHÔNG phủ lên màn hình onboarding",
      covered === false,
      covered ? "vẫn còn hộp thoại giới thiệu các thẻ chưa vào được" : "",
    );
    if (shotDir) await P.shot(`${shotDir}/onboarding-man-dau-tien.png`);

    /* ─── Khổ màn, ngay trên màn hình onboarding thật ──────────────── */
    for (const [w, h] of [
      [390, 844],
      [430, 930],
      [768, 1024],
      [1280, 900],
    ]) {
      await P.send("Emulation.setDeviceMetricsOverride", {
        width: w,
        height: h,
        deviceScaleFactor: w < 500 ? 2 : 1,
        mobile: w < 500,
      });
      await sleep(700);
      const fits = await P.eval(`document.documentElement.scrollWidth <= window.innerWidth + 1`);
      ok(`onboarding ${w}px: không tràn ngang`, fits === true);
      /*
       * Nút phải nằm trong màn, không bị bức tranh đẩy xuống dưới đáy. Đây là
       * màn hình duy nhất của app chưa có nội dung gì, nên nó toàn ảnh — và một
       * cái nút không với tới được thì tệ hơn hẳn một trang không có ảnh.
       */
      const reachable = await P.eval(`(() => {
        const b = [...document.querySelectorAll('button')].find(e => /^Tiếp tục$/.test((e.textContent||"").trim()));
        if (!b) return "không thấy nút";
        const r = b.getBoundingClientRect();
        if (r.top >= 0 && r.bottom <= window.innerHeight + 1) return true;
        return "nút ở " + Math.round(r.top) + "–" + Math.round(r.bottom) + "px, màn cao " + window.innerHeight + "px";
      })()`);
      ok(`onboarding ${w}px: nút "Tiếp tục" nằm trong màn hình`, reachable === true, reachable === true ? "" : String(reachable));
      if (shotDir) await P.shot(`${shotDir}/onboarding-${w}.png`);
    }
    await P.viewport(390, 844, true, 2);
    await sleep(500);

    await typeAndWait(P, "Góc E2E", "/^Tiếp tục$/");
    await clickUntil(P, CLICK("/^Tiếp tục$/"), `/Mã PIN xoá/.test(document.body.innerText)`);
    ok("bước 1 → bước 2 (đặt mã PIN, tuỳ chọn)", await P.eval(`/Mã PIN xoá/.test(document.body.innerText)`));

    await clickUntil(
      P,
      CLICK("/^Tạo không gian$/"),
      `location.pathname !== "/onboarding" || /Đang tạo/.test(document.body.innerText)`,
    );
    await P.until(`location.pathname !== "/onboarding"`, { timeout: 40000 }).catch(() => {});
    await sleep(1500);
    const afterCreate = await P.eval(`location.pathname`);
    ok(`tạo xong thì vào thẳng ${FRONT_DOOR}, không phải trang cài đặt`, afterCreate === FRONT_DOOR, afterCreate);

    const created = await db.collection("spaces").findOne({ name: "Góc E2E" });
    if (created) spaceIds.push(created._id);
    ok("và không gian có thật trong DB", !!created);
    if (shotDir) await P.shot(`${shotDir}/onboarding-sau-khi-tao.png`);

    // Hộp thoại chào mừng thuộc về màn hình app đầu tiên — ở đây thì đúng chỗ.
    ok("hộp thoại chào mừng xuất hiện ở màn hình app đầu tiên", (await P.eval(hasWelcome)) === true);

    await P.goto(`${base}/onboarding`);
    await sleep(2500);
    const reopened = await P.eval(`location.pathname`);
    ok("đã có không gian mà mở lại /onboarding thì bị đẩy vào app", reopened === FRONT_DOOR, reopened);

    /* ─── B. Đăng ký → onboarding → THAM GIA bằng mã ───────────────── */
    await seedSpace("Góc đã đủ người", [ghost, ghost2], "E2EFULL001");
    await seedSpace("Góc hết hạn", [ghost], "E2EEXPIRED", new Date(Date.now() - 60_000));
    const openSpace = await seedSpace("Góc của Bình", [ghost], "E2EOPEN001");

    await P.send("Network.clearBrowserCookies");
    await P.goto(`${base}/`);
    await P.eval(`try { localStorage.clear(); sessionStorage.clear(); } catch {}`).catch(() => {});
    const emailB = `e2e-onb-b-${stamp}@example.com`;
    emails.push(emailB);
    await signUpThroughForm(P, base, { name: "Người Mới B", email: emailB, gender: "male" });
    await P.until(`location.pathname === "/onboarding"`, { timeout: 40000 }).catch(() => {});
    await clickUntil(P, CLICK("/^Tham gia$/"), `/Vào không gian có sẵn/.test(document.body.innerText)`);

    /*
     * Bốn ngã rẽ, bốn câu khác nhau. Trước đây cả bốn cùng một câu, và ba
     * trong số đó bảo người ta làm một việc không cứu được gì.
     */
    const said = {};
    let previous = null;
    for (const [code, key] of [
      ["KHONGCOTHAT", "bia"],
      ["E2EEXPIRED", "hethan"],
      ["E2EFULL001", "day"],
    ]) {
      await typeAndWait(P, code, "/^Tham gia$/");
      /*
       * Đợi câu MỚI, không phải đợi "có câu nào đó": lời báo của lần trước
       * vẫn nằm nguyên trên màn hình cho tới khi lần này trả lời, nên
       * "đã có chữ đỏ" là điều kiện luôn đúng ngay lập tức từ lần thứ hai —
       * và bộ kiểm sẽ đọc lại đúng câu cũ mà tưởng là câu mới.
       */
      await clickUntil(
        P,
        CLICK("/^Tham gia$/", { last: true }),
        // Không chỉ "khác câu trước": `mutate()` xoá lỗi cũ ngay khi bắt đầu,
        // nên có một khoảnh khắc không còn chữ đỏ nào — và đọc đúng lúc đó thì
        // tưởng là màn hình im lặng.
        `(() => { const t = ${errorText}; return t !== null && t !== ${JSON.stringify(previous)}; })()`,
        { tries: 12 },
      );
      await sleep(400);
      said[key] = await P.eval(errorText);
      previous = said[key];
      if (shotDir) await P.shot(`${shotDir}/onboarding-ma-${key}.png`);
    }
    ok("mã bịa cũng được giải thích, không im lặng", !!said.bia, said.bia ?? "(không báo gì)");
    ok("mã hết hạn được gọi đúng tên là hết hạn", /hết hạn/.test(said.hethan ?? ""), said.hethan ?? "(không báo gì)");
    ok(
      "không gian đã đủ hai người thì nói thế, không bảo thử lại",
      /đủ hai người/.test(said.day ?? ""),
      said.day ?? "(không báo gì)",
    );
    ok(
      "ba kiểu hỏng cho ba câu khác nhau",
      new Set([said.bia, said.hethan, said.day]).size === 3,
      JSON.stringify(said),
    );

    /*
     * Cái được gửi qua Zalo là một ĐƯỜNG LIÊN KẾT, mà ô này thì hỏi "mã" —
     * nên việc tự nhiên nhất là dán cả link vào đây.
     */
    await typeAndWait(P, `${base}/moi/E2EOPEN001?utm=zalo`, "/^Tham gia$/");
    const inBox = await P.eval(`document.querySelector('input').value`);
    ok("dán cả đường liên kết thì ô mã tự lấy đúng mã ra", inBox === "E2EOPEN001", inBox);

    await clickUntil(
      P,
      CLICK("/^Tham gia$/", { last: true }),
      `location.pathname !== "/onboarding" || /Đang kết nối/.test(document.body.innerText)`,
    );
    await P.until(`location.pathname !== "/onboarding"`, { timeout: 40000 }).catch(() => {});
    await sleep(1500);
    const afterJoin = await P.eval(`location.pathname`);
    ok(`tham gia xong cũng vào ${FRONT_DOOR}, giống hệt lúc nhận lời mời qua link`, afterJoin === FRONT_DOOR, afterJoin);

    const joined = await db.collection("spaces").findOne({ _id: ObjectId.createFromHexString(openSpace) });
    ok("và trong DB họ đã là thành viên", (joined?.members?.length ?? 0) === 2, `members=${joined?.members?.length}`);
    const cookie = await P.eval(`document.cookie.includes("active_space_id=${openSpace}")`);
    ok("không gian đang dùng trỏ đúng chỗ vừa vào", cookie === true);
    if (shotDir) await P.shot(`${shotDir}/onboarding-sau-khi-tham-gia.png`);

    /* ─── C. Chưa đăng nhập mà mở thẳng /onboarding ────────────────── */
    await P.send("Network.clearBrowserCookies");
    await P.goto(`${base}/onboarding`);
    await sleep(2500);
    const guest = await P.eval(`location.pathname`);
    ok("chưa đăng nhập mà mở /onboarding thì được đưa về đăng nhập", guest === "/sign-in", guest);

  } finally {
    await db.collection("user").deleteMany({ email: { $in: emails } }).catch(() => {});
    for (const id of spaceIds) {
      await db.collection("spaces").deleteOne({ _id: id }).catch(() => {});
      await db.collection("specialdates").deleteMany({ spaceId: String(id) }).catch(() => {});
    }
    P.close();
    chrome.kill();
  }
  return results;
}
