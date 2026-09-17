/*
 * Gõ "@" để chọn người, trong một trình duyệt thật.
 *
 * Phần đáng tự động hoá không phải "danh sách có hiện không" — mà là phím
 * Enter. Bàn phím tiếng Việt Telex chốt một âm tiết bằng một sự kiện đến đây
 * dưới dạng Enter kèm `isComposing: true`; nếu Enter được nối thẳng vào "chọn
 * tên đang sáng" thì mỗi lần người ta gõ xong một chữ là một cái tên bị chèn
 * vào giữa câu. Không unit test nào chạm tới được chỗ đó: `isComposing` là
 * thuộc tính của sự kiện bàn phím thật.
 *
 * Ba thứ còn lại cũng chỉ sống trong trình duyệt: danh sách đóng lại sau khi
 * chọn (con trỏ nằm ngay sau tên vừa chèn, nên bộ dò vẫn thấy một truy vấn
 * đang gõ và đã mở lại đúng cái tên vừa được chọn), Escape đóng ĐÚNG cái "@"
 * đó chứ không đóng vĩnh viễn, và ô nhập giữ nguyên vai trò combobox.
 *
 * Không ghi gì vào DB: bộ này chỉ mở form rồi gõ, và không bấm Lưu.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Nhắc tên: gõ @ ra danh sách, tên MÌNH cũng là tag, và bình luận";

const FIELD = 'textarea[placeholder^="Kể lại"]';

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 430, height: 930 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });

  const type = async (text) => {
    for (const ch of text) {
      await page.send("Input.dispatchKeyEvent", { type: "keyDown", text: ch, key: ch });
      await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: ch });
    }
    await new Promise((r) => setTimeout(r, 250));
  };
  const press = async (key) => {
    const code = { ArrowDown: 40, ArrowUp: 38, Enter: 13, Escape: 27, Backspace: 8 }[key];
    await page.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key, windowsVirtualKeyCode: code });
    await page.send("Input.dispatchKeyEvent", { type: "keyUp", key });
    await new Promise((r) => setTimeout(r, 250));
  };
  const value = () => page.eval(`document.querySelector('${FIELD}').value`);
  const listOpen = () => page.eval(`!!document.querySelector('[role="listbox"]')`);
  /*
   * Chờ bằng điều kiện, không ngủ lấy may.
   *
   * Bản đầu đọc ngay sau khi gõ "@" và thấy `aria-expanded=false` — trong khi
   * các phép sau đó, vốn chỉ chạy được khi danh sách đang mở, lại xanh hết.
   * Tức là danh sách có ra, chỉ là chưa kịp vẽ. Một `setTimeout` dài hơn thì
   * hết đỏ nhưng vẫn là đoán; cái này hỏi đúng thứ mình cần.
   */
  const waitList = (want) =>
    page
      // `!!`, không phải chuỗi rỗng: thiếu nó thì biểu thức trả về một DOM node,
      // node không tuần tự hoá được qua CDP, và phép chờ trượt trong khi danh
      // sách đang hiện rành rành — phép kiểm ngay sau đó đọc được rows: 1.
      .until(`${want ? "!!" : "!"}document.querySelector('[role="listbox"]')`, { timeout: 10000 })
      .then(() => true)
      .catch(() => false);

  try {
    await page.viewport(430, 930, true);
    const me = await signIn(page, base, db);
    const myUid = me.uid;

    await page.goto(`${base}/timeline`);
    await page.until(`document.readyState === "complete"`, { timeout: 60000 }).catch(() => {});
    await page.until(
      `[...document.querySelectorAll('button')].some(b => /^\\+ Thêm$/.test((b.textContent||'').trim()))`,
      { timeout: 60000 },
    );
    /*
     * Bấm cho tới khi form MỞ, không bấm một lần rồi chờ.
     *
     * Nút vẽ ra trước khi React gắn xong trình xử lý, nên một cú bấm đúng lúc
     * đó rơi vào hư không và bộ kiểm ngồi chờ một ô nhập không bao giờ tới.
     * Đã dính ngay lần chạy đầu của chính bộ này.
     *
     * `onboarding.mjs` có một `clickUntil` đầy đủ hơn, nhưng nó là hàm nội bộ
     * của bộ đó — hai bộ kiểm không nên phụ thuộc vào nhau. Nếu chỗ này cần
     * đến lần thứ ba thì hãy đưa nó vào `cdp.mjs`.
     */
    let formOpen = false;
    for (let i = 0; i < 10 && !formOpen; i++) {
      await page.eval(
        `[...document.querySelectorAll('button')].find(b => /^\\+ Thêm$/.test((b.textContent||'').trim()))?.click()`,
      );
      formOpen = await page
        .until(`!!document.querySelector('${FIELD}')`, { timeout: 2000 })
        .then(() => true)
        .catch(() => false);
    }
    ok("mở được form thêm kỷ niệm", formOpen === true);
    if (!formOpen) return results;
    await page.eval(`document.querySelector('${FIELD}').focus()`);

    /* ——— 1. gõ @ và lọc bằng chữ KHÔNG DẤU ————————————————————— */
    const partner = await db
      .collection("spaces")
      .findOne({ _id: (await import("mongodb")).ObjectId.createFromHexString(me.spaceId) });
    ok("không gian có hai người để mà nhắc tên", (partner?.members?.length ?? 0) >= 2,
      `members=${partner?.members?.length}`);

    await type("@");
    ok("gõ @ là hiện danh sách người", (await waitList(true)) === true);
    const combo = JSON.parse(await page.eval(`(() => {
      const f = document.querySelector('${FIELD}');
      const lb = document.querySelector('[role="listbox"]');
      return JSON.stringify({
        role: f.getAttribute('role'),
        expanded: f.getAttribute('aria-expanded'),
        controls: f.getAttribute('aria-controls') === lb?.id,
        active: !!f.getAttribute('aria-activedescendant'),
        rows: lb ? lb.querySelectorAll('[role="option"]').length : 0,
        // Trỏ đúng vào một hàng CÓ THẬT, không phải một id chết.
        pointsAtRealRow: !!document.getElementById(f.getAttribute('aria-activedescendant') || ''),
      });
    })()`));
    ok("ô nhập là combobox đúng chuẩn", combo.role === "combobox" && combo.expanded === "true",
      JSON.stringify(combo));
    ok("…và trỏ vào một hàng có thật trong danh sách",
      combo.controls === true && combo.active === true && combo.pointsAtRealRow === true,
      JSON.stringify(combo));
    if (shotDir) await page.shot(`${shotDir}/mention-list.png`);

    /* ——— 2. ENTER LÚC ĐANG GÕ TELEX: tuyệt đối không được chèn ——— */
    const before = await value();
    await page.eval(`(() => {
      document.querySelector('${FIELD}').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }),
      );
    })()`);
    await new Promise((r) => setTimeout(r, 300));
    const afterIme = await value();
    ok("Enter trong lúc gõ Telex KHÔNG chèn tên", afterIme === before,
      `trước=${JSON.stringify(before)} sau=${JSON.stringify(afterIme)}`);

    /* ——— 3. Enter thật thì chèn, và danh sách đóng lại ————————— */
    await press("Enter");
    const picked = await value();
    ok("Enter thường thì chèn tên vào câu", /@\S/.test(picked), JSON.stringify(picked));
    ok("chọn xong thì danh sách ĐÓNG, không mời lại chính người vừa chọn",
      (await waitList(false)) === true);

    /* ——— 4. Escape đóng đúng cái @ đó, không đóng vĩnh viễn ———— */
    await type(" @");
    ok("gõ một @ mới thì lại mở", (await waitList(true)) === true);
    await press("Escape");
    ok("Escape đóng danh sách", (await waitList(false)) === true);
    await type("x");
    ok("…và gõ tiếp KHÔNG mở lại cái vừa bỏ qua", (await listOpen()) === false);

    /* ——— 5. tên của CHÍNH MÌNH cũng phải là một tag ————————————————
     *
     * Chủ repo báo: tag người kia thì Backspace xoá cả cụm, còn tag của chính
     * mình thì rụng từng chữ như chữ thường. Gốc rễ: form truyền danh sách
     * "những người có thể nhắc" — vốn đã bỏ chính mình — cho CẢ hai việc: gợi
     * ý, và nhận diện. Hai câu hỏi khác nhau dùng chung một danh sách.
     *
     * Kiểm bằng HÀNH VI, không bằng cái pill: bấm Backspace đúng một lần.
     */
    const meDoc = await db
      .collection("user")
      .findOne({ _id: (await import("mongodb")).ObjectId.createFromHexString(myUid) });
    const myName = (meDoc?.name || "").trim();
    ok("đọc được tên của chính mình để thử", myName.length > 0, `name=${JSON.stringify(myName)}`);
    if (myName) {
      await page.eval(`(() => {
        const f = document.querySelector('${FIELD}');
        const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        set.call(f, 'xin chào @' + ${JSON.stringify(myName)});
        f.dispatchEvent(new Event('input', { bubbles: true }));
        f.focus();
        f.setSelectionRange(f.value.length, f.value.length);
      })()`);
      await new Promise((r) => setTimeout(r, 400));
      const withMine = await value();
      await press("Backspace");
      const afterOne = await value();
      ok("tên của CHÍNH MÌNH xoá nguyên cụm, không rụng từng chữ",
        afterOne === "xin chào ",
        `trước=${JSON.stringify(withMine)} sau MỘT Backspace=${JSON.stringify(afterOne)}`);
    }

    /* ——— 6. bình luận dưới kỷ niệm ————————————————————————————— */
    await page.eval(
      `[...document.querySelectorAll('button')].find(b => /^Huỷ$/.test((b.textContent||'').trim()))?.click()`,
    );
    const { ObjectId } = await import("mongodb");
    const memoId = String(
      (
        await db.collection("memories").insertOne({
          spaceId: me.spaceId, title: "Kỷ niệm để thử bình luận",
          photos: [], embeds: [], tags: [], mentions: [],
          date: new Date("2026-05-01"), createdBy: myUid,
          createdAt: new Date(), updatedAt: new Date(),
        })
      ).insertedId,
    );
    await page.goto(`${base}/timeline?memory=${memoId}`);
    await page.until(`document.readyState === "complete"`, { timeout: 60000 }).catch(() => {});
    const gotBox = await page
      .until(`!!document.querySelector('textarea[placeholder^="Viết bình luận"]')`, { timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    ok("mở kỷ niệm là thấy ô bình luận", gotBox === true);
    if (gotBox) {
      await page.eval(`document.querySelector('textarea[placeholder^="Viết bình luận"]').focus()`);
      await type("đẹp quá @");
      ok("gõ @ trong ô bình luận cũng ra danh sách", (await waitList(true)) === true);
      await press("Enter");
      await page.eval(
        `[...document.querySelectorAll('button')].find(b => /^Gửi$/.test((b.textContent||'').trim()))?.click()`,
      );
      /*
       * Chờ HÀNG trong thread, đừng chờ chữ trong `body.innerText`.
       *
       * Chrome tính cả nội dung của `<textarea>` vào `innerText`, nên phép chờ
       * "/đẹp quá/ có trong trang" khớp ngay với chữ CÒN ĐANG NẰM TRONG Ô NHẬP
       * và trả về trước khi mutation kịp chạy. Bài kiểm xanh ở dòng đó rồi đỏ
       * hai dòng sau — trong khi tính năng vẫn đúng: DB có bản ghi, tiêu đề đã
       * là "Bình luận (1)". Đo lại bằng probe riêng mới thấy.
       */
      const posted = await page
        .until(`document.querySelectorAll('section li').length === 1`, { timeout: 30000 })
        .then(() => true)
        .catch(() => false);
      ok("gửi xong thì bình luận hiện trong thread", posted === true);
      const shape = JSON.parse(await page.eval(`(() => JSON.stringify({
        counted: /Bình luận \\(1\\)/.test(document.body.innerText),
        canDeleteOwn: !!document.querySelector('[aria-label="Xoá bình luận"]'),
      }))()`));
      ok("thread đếm đúng số bình luận", shape.counted === true, JSON.stringify(shape));
      ok("dòng của mình có nút xoá", shape.canDeleteOwn === true);
      await page.eval(`document.querySelector('[aria-label="Xoá bình luận"]')?.click()`);
      const gone = await page
        .until(`document.querySelectorAll('section li').length === 0`, { timeout: 30000 })
        .then(() => true)
        .catch(() => false);
      ok("xoá được dòng của chính mình", gone === true);
    }
    await db.collection("memories").deleteOne({ _id: ObjectId.createFromHexString(memoId) });
    await db.collection("memorycomments").deleteMany({ memoryId: memoId });
  } finally {
    page.close();
    chrome.kill();
  }
  return results;
}
