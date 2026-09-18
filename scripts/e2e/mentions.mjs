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

export const name = "Nhắc tên: gõ @ ra danh sách, tên MÌNH cũng là tag, và ghi chú trên thẻ";

const NOTE_MEMO_TITLE = "Kỷ niệm để thử ghi chú";

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

    /* ——— 6. bình luận NGAY TRÊN THẺ ngoài danh sách ————————————————
     *
     * Chỗ này là điểm mấu chốt, không phải chi tiết trình bày: người ta đọc
     * feed và trả lời ngay tại thẻ, không mở kỷ niệm ra mới nói chuyện. Từng
     * có hai luồng bình luận song song — một cái trên thẻ (không tag được) và
     * một cái trong modal (tag được) — nên bài này đo ĐÚNG luồng trên thẻ, rồi
     * mở modal ra kiểm rằng nó thấy cùng một dòng chứ không phải luồng khác.
     */
    await page.eval(
      `[...document.querySelectorAll('button')].find(b => /^Huỷ$/.test((b.textContent||'').trim()))?.click()`,
    );
    const { ObjectId } = await import("mongodb");
    const memoId = String(
      (
        await db.collection("memories").insertOne({
          spaceId: me.spaceId, title: NOTE_MEMO_TITLE,
          photos: [], embeds: [], tags: [], mentions: [],
          // Ngày HÔM NAY, không phải một ngày cố định trong quá khứ: feed xếp
          // theo tháng và chỉ tải 24 mục, nên một kỷ niệm tháng 5 có thể không
          // nằm trong trang đầu.
          date: new Date(), createdBy: myUid,
          createdAt: new Date(), updatedAt: new Date(),
        })
      ).insertedId,
    );

    const NOTE_BOX = `input[placeholder^="Viết ghi chú"]`;
    /*
     * Tìm ĐÚNG thẻ của kỷ niệm vừa gieo, không phải thẻ đầu tiên.
     *
     * Feed chứa cả kỷ niệm của những bộ kiểm khác chạy trước. Bấm vào thẻ đầu
     * tiên thì ghi chú rơi vào kỷ niệm của người khác, và bài kiểm đỏ ở hai
     * dòng sau đó với lý do chẳng liên quan gì — mất thời gian đi tìm.
     */
    const cardOf = (title) => `(() => {
      const label = [...document.querySelectorAll("h1,h2,h3,h4,p,span,div")]
        .find(e => (e.textContent || "").trim() === ${JSON.stringify(title)});
      let n = label;
      while (n && !(n.querySelector && n.querySelector('button[aria-expanded]'))) n = n.parentElement;
      return n;
    })()`;
    await page.goto(`${base}/timeline`);
    await page.until(`document.readyState === "complete"`, { timeout: 60000 }).catch(() => {});

    // Luồng thu gọn cho tới khi bấm — mở ra bằng chính nút người dùng bấm.
    const opened = await page
      .until(
        `(() => {
          const card = ${cardOf(NOTE_MEMO_TITLE)};
          if (!card) return false;
          const b = [...card.querySelectorAll('button[aria-expanded]')]
            .find(x => /ghi chú/i.test(x.textContent || ""));
          if (!b) return false;
          if (b.getAttribute('aria-expanded') !== 'true') { b.click(); return false; }
          return !!card.querySelector(${JSON.stringify(NOTE_BOX)});
        })()`,
        { timeout: 30000 },
      )
      .then(() => true)
      .catch(() => false);
    ok("thẻ ngoài danh sách có ô ghi chú, không phải mở kỷ niệm mới có", opened === true);

    if (opened) {
      await page.eval(`${cardOf(NOTE_MEMO_TITLE)}.querySelector(${JSON.stringify(NOTE_BOX)}).focus()`);
      await type("đẹp quá @");
      ok("gõ @ ngay trên thẻ cũng ra danh sách", (await waitList(true)) === true);
      await press("Enter");
      await page.eval(
        `document.querySelector('[aria-label="Gửi ghi chú"]')?.click()`,
      );

      /*
       * Chờ HÀNG trong luồng, đừng chờ chữ trong `body.innerText` — Chrome
       * tính cả nội dung ô nhập vào đó, nên phép chờ khớp ngay với chữ CÒN
       * ĐANG NẰM TRONG Ô và trả về trước khi mutation kịp chạy.
       */
      const posted = await page
        .until(`document.querySelectorAll('[aria-label="Xoá ghi chú"]').length === 1`, { timeout: 30000 })
        .then(() => true)
        .catch(() => false);
      ok("gửi xong thì ghi chú hiện trên thẻ", posted === true);

      /*
       * Và tên phải là THẺ, không phải chữ thô.
       *
       * Đây chính là thứ hỏng trước đây: ô trên thẻ nhận chữ bình thường nên
       * "@Tên" lưu xuống rồi hiện lại y như một chuỗi ký tự. Đo bằng
       * `data-mention` — thứ chỉ MentionText mới sinh ra — chứ không đo bằng
       * việc chữ có xuất hiện hay không, vì chữ thô cũng xuất hiện.
       */
      const tagged = JSON.parse(await page.eval(`(() => {
        const row = document.querySelector('[aria-label="Xoá ghi chú"]')?.closest('li');
        const pill = row?.querySelector('[data-mention]');
        return JSON.stringify({
          hasPill: !!pill,
          pillText: pill?.textContent || "",
          rowText: (row?.innerText || "").slice(0, 80),
        });
      })()`));
      ok("tên trong ghi chú hiện thành thẻ, không phải chữ thô",
         tagged.hasPill === true && tagged.pillText.startsWith("@"), JSON.stringify(tagged));

      // Máy chủ có ghi nhận người được nhắc, chứ không chỉ đẹp ở màn hình.
      /*
       * Máy chủ có LƯU người được nhắc không.
       *
       * Thẻ tên trên màn hình KHÔNG chứng minh được điều này: nó dựng từ chữ
       * trong `body`, còn thông báo thì gửi theo danh sách id. Hai đường độc
       * lập, nên nhìn thấy thẻ mà không đọc DB là bỏ lọt đúng nửa quan trọng.
       *
       * `mentions` vắng mặt HẲN (khác với `[]`) có một nguyên nhân riêng, và
       * nó không phải lỗi sản phẩm: mongoose cache model theo tiến trình
       * (`models.Note ?? model(...)`), nên một dev server khởi động TRƯỚC khi
       * schema thêm trường sẽ lặng lẽ vứt trường đó đi — không lỗi, không cảnh
       * báo. Máy chủ bao giờ cũng ghi ít nhất `[]`, nên `undefined` là vân tay
       * của đúng tình huống ấy. Gọi tên nó ra, đừng để người đọc đi tìm.
       */
      const stored = await db.collection("notes").findOne({ targetId: memoId });
      if (stored && stored.mentions === undefined) {
        ok("máy chủ lưu lại người được nhắc trong ghi chú", false,
           "dev server khởi động TRƯỚC khi schema Note thêm `mentions` — mongoose giữ model cũ " +
           "và vứt trường lạ. Khởi động lại dev server rồi chạy lại bộ này.");
      } else {
        ok("máy chủ lưu lại người được nhắc trong ghi chú",
           Array.isArray(stored?.mentions) && stored.mentions.length === 1,
           JSON.stringify(stored?.mentions ?? null));
      }

      /*
       * Mở modal chi tiết: phải thấy ĐÚNG dòng vừa viết.
       *
       * Thông báo "bạn vừa được nhắc tên" mở thẳng vào URL này. Nếu modal đọc
       * một luồng khác thì người được nhắc bấm vào sẽ thấy một trang trống.
       */
      await page.goto(`${base}/timeline?memory=${memoId}`);
      await page.until(`document.readyState === "complete"`, { timeout: 60000 }).catch(() => {});
      const inModal = await page
        .until(
          `(() => {
            const b = [...document.querySelectorAll('button[aria-expanded]')]
              .find(x => /ghi chú/i.test(x.textContent || ""));
            if (!b) return false;
            if (b.getAttribute('aria-expanded') !== 'true') { b.click(); return false; }
            return document.querySelectorAll('[aria-label="Xoá ghi chú"]').length >= 1;
          })()`,
          { timeout: 30000 },
        )
        .then(() => true)
        .catch(() => false);
      ok("mở kỷ niệm ra thấy CÙNG một luồng, không phải luồng thứ hai", inModal === true);

      /* ——— dữ liệu XẤU: tên dài trong ghi chú trên thẻ hẹp ————————————
       *
       * Thẻ trong feed hẹp hơn modal nhiều, và thẻ tên dùng
       * `box-decoration-break: clone` nên khi xuống dòng nó nhân đôi phần
       * đệm hai bên. Tên đẹp thì không bao giờ lộ ra chuyện đó. Đo ở khổ điện
       * thoại, bằng đúng hộp đang cuộn — `documentElement.scrollWidth` không
       * bao giờ rộng ra trong app này vì PageShell tự bọc một khung cuộn.
       */
      const LONG = "Nguyễn Thị Hoàng Mai Phương Thảo Quỳnh Anh Ngọc Diệp";
      const partnerUid = (partner?.members ?? []).find((id) => String(id) !== myUid);
      const partnerDoc = partnerUid
        ? await db.collection("user").findOne({ _id: ObjectId.createFromHexString(String(partnerUid)) })
        : null;
      const oldName = partnerDoc?.name ?? null;
      if (partnerUid && oldName) {
        await db.collection("user").updateOne(
          { _id: ObjectId.createFromHexString(String(partnerUid)) },
          { $set: { name: LONG } },
        );
        await db.collection("notes").updateOne(
          { targetId: memoId },
          { $set: { body: `Đẹp quá @${LONG} ơi, hôm đó vui thật đấy` } },
        );
        for (const w of [390, 360]) {
          await page.viewport(w, 780, true);
          await page.goto(`${base}/timeline`);
          await page.until(`document.readyState === "complete"`, { timeout: 60000 }).catch(() => {});
          const drew = await page
            .until(
              `(() => {
                const b = [...document.querySelectorAll('button[aria-expanded]')]
                  .find(x => /ghi chú/i.test(x.textContent || ""));
                if (!b) return false;
                if (b.getAttribute('aria-expanded') !== 'true') { b.click(); return false; }
                return !!document.querySelector('[data-mention]');
              })()`,
              { timeout: 30000 },
            )
            .then(() => true)
            .catch(() => false);
          ok(`tên dài vẫn đọc ra thẻ ở ${w}px`, drew === true);
          const spill = await page.horizontalOverflow();
          ok(`ghi chú có tên dài ở ${w}px: không tràn ngang`, spill === null, spill ?? "");
        }
        // Trả tên về, không để một bài kiểm đổi dữ liệu cho bài sau.
        await db.collection("user").updateOne(
          { _id: ObjectId.createFromHexString(String(partnerUid)) },
          { $set: { name: oldName } },
        );
      }
      await page.viewport(430, 930, true);
      await page.goto(`${base}/timeline?memory=${memoId}`);
      await page.until(`document.readyState === "complete"`, { timeout: 60000 }).catch(() => {});
      await page.until(
        `(() => {
          const b = [...document.querySelectorAll('button[aria-expanded]')]
            .find(x => /ghi chú/i.test(x.textContent || ""));
          if (!b) return false;
          if (b.getAttribute('aria-expanded') !== 'true') { b.click(); return false; }
          return document.querySelectorAll('[aria-label="Xoá ghi chú"]').length >= 1;
        })()`,
        { timeout: 30000 },
      ).catch(() => {});

      // Xoá: nút idle rồi mới tới nút xác nhận trong modal.
      await page.eval(`document.querySelector('[aria-label="Xoá ghi chú"]')?.click()`);
      await page.until(
        `[...document.querySelectorAll('button')].some(b => /^Xoá ghi chú$/.test((b.textContent||'').trim()))`,
        { timeout: 15000 },
      ).catch(() => {});
      await page.eval(
        `[...document.querySelectorAll('button')].find(b => /^Xoá ghi chú$/.test((b.textContent||'').trim()))?.click()`,
      );
      const gone = await page
        .until(`document.querySelectorAll('[aria-label="Xoá ghi chú"]').length === 0`, { timeout: 30000 })
        .then(() => true)
        .catch(() => false);
      ok("xoá được dòng của chính mình", gone === true);
    }
    await db.collection("memories").deleteOne({ _id: ObjectId.createFromHexString(memoId) });
    await db.collection("notes").deleteMany({ targetId: memoId });
  } finally {
    page.close();
    chrome.kill();
  }
  return results;
}
