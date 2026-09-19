/*
 * Mất mạng phải NÓI LÀ MẤT MẠNG, không được nói "chưa có kỷ niệm nào".
 *
 * React Query mặc định `networkMode: "online"` **tạm dừng** truy vấn khi máy
 * offline: trạng thái đứng ở `pending` với `fetchStatus: "paused"` và không bao
 * giờ tới `isError`. Đo trên chính app này: năm màn rẽ theo `isLoading` (vốn là
 * false khi đang tạm dừng) rơi thẳng xuống trạng thái rỗng — tức bảo hai người
 * rằng kỷ niệm của họ biến mất — còn chín thẻ "Thử lại" viết sẵn thì không bao
 * giờ hiện ra được vì cái nào cũng gác bằng `isError`.
 *
 * Ba thứ cần chứng minh, và chúng cần ba điều kiện KHÁC NHAU:
 *   1. API chết trong khi máy vẫn có mạng  → phải ra thẻ "Thử lại", không phải
 *      trạng thái rỗng. Đây là phần `networkMode`.
 *   2. Mất mạng hẳn                         → thanh báo mất kết nối hiện ra.
 *   3. Mất mạng + tải cứng một route ngoài danh sách shell → trang "Đang mất
 *      kết nối" CỦA APP, không phải trang lỗi của trình duyệt. Đây là phần
 *      service worker, và nó chỉ tồn tại ở bản production.
 *
 * ⚠️ Phải SEED một kỷ niệm trước. Bản đầu của bài này không seed, nên câu
 * "Chưa có kỷ niệm nào" là câu ĐÚNG và phép đo không chứng minh được gì.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Mất mạng: nói thật, và có nút thử lại";

const LIE = "Chưa có kỷ niệm nào";
const TITLE = "E2E ky niem offline";

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 390, height: 844 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });
  let spaceId = null;

  const setOffline = (offline) =>
    page.send("Network.emulateNetworkConditions", {
      offline,
      latency: 0,
      downloadThroughput: offline ? 0 : -1,
      uploadThroughput: offline ? 0 : -1,
    });

  try {
    await page.viewport(390, 844, true, 2);
    const me = await signIn(page, base, db);
    spaceId = me.spaceId;
    await page.send("Network.enable");

    // Một kỷ niệm có thật, để "chưa có kỷ niệm nào" trở thành câu nói dối.
    await db.collection("memories").deleteMany({ spaceId, title: TITLE });
    await db.collection("memories").insertOne({
      spaceId, title: TITLE, caption: "", photos: [], tags: [],
      date: new Date(), createdBy: me.uid, createdAt: new Date(), updatedAt: new Date(),
    });

    /* ── 1. API chết, máy vẫn có mạng ─────────────────────────────────── */
    await page.send("Network.setBlockedURLs", { urls: ["*api/trpc*"] });
    await page.goto(`${base}/timeline`);
    await page.until(`document.readyState === "complete"`, { timeout: 60000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 4000));

    const dead = JSON.parse(await page.eval(`JSON.stringify({
      text: document.body.innerText.replace(/\\s+/g, " ").slice(0, 300),
      retry: [...document.querySelectorAll("button")].some(b => /Thử lại/.test(b.textContent || "")),
    })`));
    ok(
      `API chết thì KHÔNG nói "${LIE}"`,
      !dead.text.includes(LIE),
      dead.text.includes(LIE) ? "báo rỗng trong khi chỉ là không gọi được API" : "",
    );
    ok("…và hiện thẻ Thử lại", dead.retry === true, dead.retry ? "" : dead.text.slice(0, 140));
    if (shotDir) await page.shot(`${shotDir}/offline-api-down.png`);

    await page.send("Network.setBlockedURLs", { urls: [] });

    /* ── 2 + 3. Mất mạng hẳn ──────────────────────────────────────────── */
    await page.goto(`${base}/timeline`);
    await page.until(`document.readyState === "complete"`, { timeout: 60000 }).catch(() => {});
    /*
     * Chờ service worker NẮM QUYỀN, không chỉ chờ nó đăng ký: nó chỉ đăng ký ở
     * bản production, sau sự kiện `load`, rồi còn phải `claim()` mới chặn được
     * các lần điều hướng sau. Đo sớm thì cả bản đã sửa cũng ra trang lỗi của
     * trình duyệt — tức bài đo không phân biệt được gì.
     */
    const swReady = await page
      .until(`!!navigator.serviceWorker && !!navigator.serviceWorker.controller`, { timeout: 25000 })
      .then(() => true)
      .catch(() => false);
    ok("service worker đã nắm quyền", swReady, swReady ? "" : "bản dev không có SW — hai bài dưới vô nghĩa");

    await setOffline(true);
    await new Promise((r) => setTimeout(r, 1200));

    const bar = await page
      .until(`document.body.innerText.includes("Đang mất kết nối")`, { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    ok("mất mạng thì có thanh báo, kèm nút thử lại", bar);
    if (shotDir) await page.shot(`${shotDir}/offline-bar.png`);

    if (swReady) {
      /*
       * Điều cần cấm là TRANG LỖI CỦA TRÌNH DUYỆT, không phải "bắt buộc ra
       * trang offline". Một route mà app dựng được từ cache thì kết quả ấy còn
       * tốt hơn — bản đầu của bài này đòi đúng trang offline và báo đỏ chính
       * cái kết quả tốt hơn đó.
       */
      await page.goto(`${base}/vault`);
      await new Promise((r) => setTimeout(r, 2000));
      const seen = await page.eval(`document.body.innerText.replace(/\\s+/g, " ").slice(0, 200)`);
      ok(
        "route đã vào rồi: không rơi ra trang lỗi của trình duyệt",
        !/ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED/.test(seen),
        seen.slice(0, 120),
      );

      /*
       * Và một TAB MỚI TINH, tức không có app nào đang chạy sẵn để đỡ.
       *
       * Đây mới là khoảnh khắc mà trước đây luôn ra trang lỗi của Chrome: mở
       * app từ màn hình chính khi không có mạng. Trong tab đang mở thì router
       * của Next đã nằm sẵn trong bộ nhớ và tự dựng được cả trang "không tìm
       * thấy", nên đo ở đó không chạm tới nhánh cần đo.
       */
      const fresh = await openPage(port);
      try {
        await fresh.send("Network.enable");
        await fresh.send("Network.emulateNetworkConditions", {
          offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
        });
        await fresh.goto(`${base}/trips`);
        await new Promise((r) => setTimeout(r, 2500));
        const cold = await fresh.eval(`document.body.innerText.replace(/\\s+/g, " ").slice(0, 200)`);
        /*
         * Bất biến là "KHÔNG BAO GIỜ ra trang lỗi của trình duyệt", chứ không
         * phải "bắt buộc ra trang offline". App dựng được màn thật rồi nói
         * "Không tải được…" kèm nút thử lại là kết quả TỐT HƠN; hai bản trước
         * của bài này đòi đúng trang offline và báo đỏ chính cái tốt hơn ấy.
         * Trang offline là tấm lưới cuối, chỉ dùng khi không còn gì khác.
         */
        ok(
          "mở app trong tab mới khi mất mạng → màn của app, không phải trang lỗi trình duyệt",
          !/ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_FAILED/.test(cold) && cold.trim().length > 20,
          cold.slice(0, 130),
        );
        ok(
          "…và nếu không dựng được màn thì phải là trang offline của app",
          !cold.includes("Đang mất kết nối") || cold.includes("Thử lại"),
          cold.slice(0, 130),
        );
        if (shotDir) await fresh.shot(`${shotDir}/offline-cold-start.png`);
      } finally {
        fresh.close();
      }
      if (shotDir) await page.shot(`${shotDir}/offline-hard-nav.png`);
    }

    await setOffline(false);
    const back = await page
      .until(`document.body.innerText.includes("Có mạng lại rồi") || !document.body.innerText.includes("Đang mất kết nối")`, { timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    ok("có mạng lại thì tự hết, không bắt bấm", back);
  } finally {
    await setOffline(false).catch(() => {});
    if (spaceId) await db.collection("memories").deleteMany({ spaceId, title: TITLE }).catch(() => {});
    page.close();
    chrome.kill();
  }
  return results;
}
