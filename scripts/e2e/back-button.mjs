/*
 * Nút back của điện thoại, trong một trình duyệt thật.
 *
 * Không có phép kiểm nào khác chạm tới được chỗ này: `popstate`, lớp phủ do
 * thư viện tự portal ra ngoài cây React, và câu hỏi "route có đổi không" đều
 * là chuyện của trình duyệt.
 *
 * Triệu chứng đang sửa: đang xem ảnh toàn màn hình mà bấm back thì ra một màn
 * đen ghi "0/0" — vì `PhotoProvider` nằm ở gốc cây nên nó sống sót qua lần đổi
 * route, còn mấy tấm ảnh bên trong thì unmount theo trang cũ. Người dùng vừa
 * mất cái ảnh vừa bị đá về trang trước.
 *
 * `history.back()` gọi từ script phát ra ĐÚNG sự kiện `popstate` mà nút back
 * của máy phát ra, nên đây là phép đo thật chứ không phải mô phỏng.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Nút back: đóng ảnh chứ không rời trang, và bấm hai lần thì thoát";

const PHOTO = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
const VIEWER = ".PhotoView-Portal";

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 430, height: 930 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });

  try {
    const me = await signIn(page, base, db);
    const { ObjectId } = await import("mongodb");

    const memoId = String(
      (
        await db.collection("memories").insertOne({
          spaceId: me.spaceId,
          title: "Kỷ niệm để thử nút back",
          photos: [{ url: PHOTO, publicId: "sample", width: 864, height: 576 }],
          embeds: [], tags: [], mentions: [],
          date: new Date("2026-05-01"),
          createdBy: me.uid,
          createdAt: new Date(), updatedAt: new Date(),
        })
      ).insertedId,
    );

    try {
      await page.goto(`${base}/timeline?memory=${memoId}`);
      await page.until(`document.readyState === "complete"`, { timeout: 60000 }).catch(() => {});

      // Mở ảnh bằng đúng thao tác người dùng làm: bấm vào tấm ảnh trong kỷ niệm.
      const opened = await page
        .until(
          `(() => {
            if (document.querySelector('${VIEWER}')) return true;
            const img = [...document.querySelectorAll('[role="dialog"] img')]
              .find(i => (i.src || "").includes("res.cloudinary.com"));
            if (img) img.click();
            return false;
          })()`,
          { timeout: 30000 },
        )
        .then(() => true)
        .catch(() => false);
      ok("bấm vào ảnh thì mở trình xem toàn màn hình", opened === true);

      if (opened) {
        if (shotDir) await page.shot(`${shotDir}/back-viewer-open.png`);
        const before = await page.eval(`location.pathname + location.search`);

        await page.eval(`history.back()`);
        await new Promise((r) => setTimeout(r, 900));

        const after = JSON.parse(await page.eval(`(() => JSON.stringify({
          viewer: !!document.querySelector('${VIEWER}'),
          where: location.pathname + location.search,
          /*
           * "0/0" là dấu vân tay của chính cái bug: lớp phủ còn đó nhưng không
           * còn tấm ảnh nào để đếm. Tìm nó riêng, vì một lớp phủ đen rỗng vẫn
           * có thể qua được phép kiểm "viewer đã đóng chưa" nếu chỉ nhìn class.
           */
          counter: (document.querySelector('.PhotoView-Slider__Counter') || {}).textContent || "",
          dialog: !!document.querySelector('[role="dialog"]'),
        }))()`));

        ok("back đóng trình xem ảnh", after.viewer === false, JSON.stringify(after));
        ok("back KHÔNG rời trang", after.where === before, `trước=${before} sau=${after.where}`);
        ok("không còn màn đen 0/0", after.counter !== "0/0", JSON.stringify(after.counter));
        /*
         * Và kỷ niệm phía sau vẫn mở.
         *
         * Cách đóng ảnh là bắn một sự kiện phím Escape; Modal cũng nghe
         * Escape. Nếu hai cái cùng trả lời thì một cú back đóng luôn cả hai —
         * đúng loại hồi quy không ai để ý cho tới khi dùng thật.
         */
        ok("kỷ niệm đang mở phía sau vẫn còn", after.dialog === true, JSON.stringify(after));
      }

      /*
       * Bấm hai lần liên tiếp thì RA KHỎI app, không phải lùi thêm một nấc.
       *
       * Dựng đúng tình huống người dùng gặp: đi qua vài tab (mỗi lần là một
       * mục lịch sử) rồi muốn thoát. Lùi kiểu thường sẽ về đúng tab trước đó
       * và cứ thế mãi — đó là cái đang sửa.
       *
       * Phép đo phải phân biệt được "thoát" với "lùi hai nấc", nên phải đi ít
       * nhất hai nấc trước đã: lùi thường sẽ đậu lại ở một trong hai tab đó,
       * còn thoát thì không.
       */
      await page.goto(`${base}/timeline`);
      await page.until(`document.readyState === "complete"`, { timeout: 60000 }).catch(() => {});
      for (const href of ["/map", "/library"]) {
        await page.eval(
          `document.querySelector('a[href="${href}"]')?.click()`,
        );
        await page.until(`location.pathname === "${href}"`, { timeout: 30000 }).catch(() => {});
      }
      const walked = await page.eval(`location.pathname`);
      ok("đi qua hai tab bằng điều hướng trong app", walked === "/library", walked);

      if (walked === "/library") {
        await page.eval(`history.back()`);
        await new Promise((r) => setTimeout(r, 250));
        await page.eval(`history.back()`);
        await new Promise((r) => setTimeout(r, 1200));
        const landed = await page.eval(`location.pathname`);
        /*
         * Lùi kiểu thường: /library → /map → /timeline. Nên thấy bất kỳ cái
         * nào trong ba đường đó nghĩa là vẫn còn trong app, tức là chưa thoát.
         */
        ok(
          "hai lần back liên tiếp đi ra khỏi app, không đậu lại tab trước",
          !["/library", "/map", "/timeline"].includes(landed),
          `đậu ở ${landed}`,
        );
      }

    } finally {
      await db.collection("memories").deleteOne({ _id: ObjectId.createFromHexString(memoId) });
    }
  } finally {
    page.close();
    chrome.kill();
  }
  return results;
}
