/*
 * Tấm khởi động phải che TỪ khung hình đầu tiên, và chỉ ở app đã cài.
 *
 * Bản đầu của tính năng này là một client component bắt đầu bằng
 * `useState(false)` rồi mới bật lên trong `useEffect`, nên nó không có trong
 * HTML máy chủ trả về lẫn lần vẽ đầu của client: quay màn hình máy thật thấy
 * splash 4,5s → giao diện trắng → RỒI mới tới tấm phủ, và nó ở lại thêm 6 giây.
 * Một tấm che đến sau thứ nó định che chỉ là một bức tường thừa.
 *
 * Nên bài này đo bốn thứ, và hai thứ đầu là hai lỗi cũ:
 *   1. có mặt trong HTML máy chủ (không phải mọc ra sau khi hydrate);
 *   2. lúc màn còn là khung xương thì nó vẫn đang che;
 *   3. có dữ liệu rồi thì nó biến mất;
 *   4. trên TAB TRÌNH DUYỆT THƯỜNG thì không bao giờ thấy nó — thiếu vế này
 *      thì một tấm navy chớp lên ở mọi lần tải lại cũng "đạt".
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Tấm khởi động: che từ khung đầu, chỉ ở app đã cài";

/** Đang thật sự phủ kín màn hay không — hỏi chính trình duyệt, không đoán. */
const COVERING = `(() => {
  const el = document.getElementById("boot-veil");
  if (!el) return JSON.stringify({ exists: false });
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return JSON.stringify({
    exists: true,
    display: cs.display,
    visibility: cs.visibility,
    opacity: cs.opacity,
    covers: cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.5
      && r.width >= innerWidth - 1 && r.height >= innerHeight - 1,
    /* Thuộc tấm phủ là đạt — giữa màn chính là logo NẰM TRONG nó, nên đòi
       đúng phần tử gốc là đòi sai. Cái cần cấm là chạm phải nội dung app. */
    hitInVeil: (() => {
      const h = document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight / 2));
      return !!h && !!el && (h === el || el.contains(h));
    })(),
    hitTag: (() => { const h = document.elementFromPoint(Math.round(innerWidth/2), Math.round(innerHeight/2)); return h ? (h.id || h.tagName) : null; })(),
    booted: document.documentElement.hasAttribute("data-booted"),
    /* Khung xương ĐANG NHÌN THẤY — trong khung nhìn, đủ to để mắt bắt được. */
    bones: [...document.querySelectorAll(".animate-pulse")].filter((b) => {
      const q = b.getBoundingClientRect();
      return q.width > 4 && q.height > 4 && q.bottom > 0 && q.top < innerHeight;
    }).length,
  });
})()`;

/**
 * Bất biến cần giữ, thay cho phép đo bằng đồng hồ.
 *
 * Bản trước hỏi "sau 1500ms thì tấm che còn không?" — câu trả lời phụ thuộc
 * vào lúc đó truy vấn đã về chưa, tức phụ thuộc tải máy. Đo thật: đỏ 1/3 lần
 * NGAY TRÊN CÂY CHƯA SỬA GÌ. Một cổng chập chờn thì không chứng minh được gì.
 *
 * Cái thật sự cần đúng: **không có khoảnh khắc nào khung xương hiện ra trong
 * khi tấm che đã gỡ**. Lấy mẫu liên tục từ lúc điều hướng tới lúc gỡ xong, rồi
 * soi lại cả chuỗi — không có mốc thời gian nào trong đó.
 */
async function watchBoot(app, base, { ms = 16000, everyMs = 120 } = {}) {
  const samples = [];
  app.send("Page.navigate", { url: `${base}/home` }).catch(() => {});
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const snap = JSON.parse(await app.eval(COVERING));
      samples.push(snap);
      // Gỡ xong VÀ đã có nội dung thì hết chuyện để xem.
      if (snap.booted && snap.bones === 0 && samples.length > 3) break;
    } catch { /* trang đang điều hướng, chưa nói chuyện được */ }
    await new Promise((r) => setTimeout(r, everyMs));
  }
  return samples;
}

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 390, height: 844 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });

  try {
    await page.viewport(390, 844, true, 2);
    await signIn(page, base, db);

    /* ── 1. Có trong HTML máy chủ trả về ─────────────────────────────── */
    const html = await fetch(`${base}/sign-in`).then((r) => r.text());
    ok(
      "nằm sẵn trong HTML máy chủ, không đợi hydrate",
      html.includes('id="boot-veil"'),
      html.includes("boot-veil") ? "" : "không thấy trong HTML — lại là bản mọc sau khi hydrate",
    );

    /* ── 2 + 3. Chế độ app ĐÃ CÀI ────────────────────────────────────
     * Phải mở Chrome bằng `--app=`: CDP **không** giả lập được `display-mode`
     * (đã thử `Emulation.setEmulatedMedia` — `matchMedia` vẫn trả browser), và
     * tab mở thêm trong cửa sổ app cũng là tab thường. Chỉ tab gốc của cửa sổ
     * `--app=` mới báo `standalone`, nên phải nối vào chính nó.
     */
    const appChrome = await launchChrome(`${profileDir}-app`, port + 100, {
      width: 390,
      height: 844,
      extraArgs: [`--app=${base}/home`],
    });
    const app = await openPage(port + 100, { existing: true });
    try {
      await app.send("Runtime.enable").catch(() => {});
      /*
       * Cửa sổ `--app=` dùng PROFILE RIÊNG nên chưa đăng nhập: `/home` bị đưa
       * về `/sign-in`, và `/sign-in` không nằm trong danh sách route tự báo sẵn
       * sàng nên tấm phủ gỡ theo mốc `load` — tức bài đo đứng ở trang khác với
       * trang nó tưởng. Đăng nhập trước đã.
       */
      await signIn(app, base, db);
      const standalone = await app.eval(`matchMedia('(display-mode: standalone)').matches`);
      ok("mở được cửa sổ ở chế độ app đã cài", standalone === true,
         standalone ? "" : "không vào được standalone — hai bài dưới vô nghĩa");

      if (standalone) {
        /*
         * Làm mạng CHẬM, không phải chặn.
         *
         * Bản đầu của bài này chặn hẳn `dashboard.today` — nhưng chặn thì truy
         * vấn LỖI, mà lỗi thì tấm phủ tự gỡ đúng theo thiết kế (thà thấy thẻ
         * "thử lại" còn hơn ngồi nhìn navy). Thứ cần dựng lại là truy vấn còn
         * đang chạy, tức màn đang là khung xương.
         */
        await app.send("Network.enable");
        await app.send("Network.emulateNetworkConditions", {
          offline: false, latency: 4000, downloadThroughput: -1, uploadThroughput: -1,
        });
        const seen = await watchBoot(app, base);
        const withBones = seen.filter((x) => x.bones > 0);
        const leaked = withBones.filter((x) => !x.covers);

        /*
         * Kỳ vọng ÂM trước: không thấy khung xương lần nào thì bài dưới đạt
         * một cách rỗng tuếch — đúng cái bẫy đã dính ở bài kiểm đường đi.
         */
        ok("dựng lại được đúng lúc màn còn khung xương",
           withBones.length > 0,
           `${seen.length} mẫu, không mẫu nào có khung xương — mạng chưa đủ chậm?`);
        ok("không có lúc nào khung xương hiện ra mà tấm phủ đã gỡ",
           withBones.length > 0 && leaked.length === 0,
           leaked.length
             ? `${leaked.length}/${withBones.length} mẫu bị hở, mẫu đầu: ${JSON.stringify(leaked[0])}`
             : "");
        const covering = withBones.find((x) => x.covers);
        ok("…và không có gì của app lọt lên trên tấm phủ",
           !!covering && covering.hitInVeil === true,
           covering ? `giữa màn đang là: ${covering.hitTag}` : "không có mẫu nào đang che");
        if (shotDir) await app.shot(`${shotDir}/boot-veil-covering.png`);

        await app.send("Network.emulateNetworkConditions", {
          offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
        });
        await app.goto(`${base}/home`);
        const gone = await app
          .until(`document.documentElement.hasAttribute("data-booted")`, { timeout: 20000 })
          .then(() => true)
          .catch(() => false);
        await new Promise((r) => setTimeout(r, 700));
        const after = JSON.parse(await app.eval(COVERING));
        ok("có dữ liệu rồi thì tấm phủ biến mất", gone && after.covers === false, JSON.stringify(after));
        if (shotDir) await app.shot(`${shotDir}/boot-veil-after.png`);
      }
    } finally {
      app.close();
      appChrome.kill();
    }

    /* ── 4. Kỳ vọng ÂM: tab trình duyệt thường ───────────────────────── */
    await page.goto(`${base}/home`);
    await new Promise((r) => setTimeout(r, 900));
    const web = JSON.parse(await page.eval(COVERING));
    ok(
      "trên tab trình duyệt thường thì KHÔNG bao giờ hiện",
      web.exists && web.display === "none",
      JSON.stringify(web),
    );
  } finally {
    page.close();
    chrome.kill();
  }
  return results;
}
