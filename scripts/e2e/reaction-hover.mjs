/*
 * Rê chuột từ trái tim lên hàng cảm xúc — hàng đó phải sống sót cả quãng đường.
 *
 * Người dùng báo: "bar đang bị ẩn đi khi tôi đưa chuột lên chọn react, trong
 * quãng đường đi không được bắc cầu đúng cách". Đo được trước khi sửa: hàng
 * cảm xúc nổi lên trên nút một quãng 10px không thuộc về ai, `pointerleave`
 * bắn ở khung ngoài, và KHÔNG có gì huỷ hẹn giờ đóng khi con trỏ vào tới hàng
 * — nên tới bước 7 trên 10 là nó tắt, đứng yên trên nó 900ms vẫn tắt.
 *
 * Không unit test nào chạm tới được: đây là chuỗi pointerenter/pointerleave
 * thật, sinh ra từ vị trí con trỏ thật.
 *
 * ⚠️ Headless ở máy này mặc định báo `(hover: none)` và `(pointer: coarse)`,
 * nên nhánh hover của app không chạy và bài kiểm sẽ xanh một cách vô nghĩa.
 * `Emulation.setEmulatedMedia` KHÔNG đổi được hai đặc tính đó — chỉ
 * blink-settings lúc khởi chạy mới đổi. Bài đầu tiên dưới đây gác chính điều
 * kiện đó, để nếu cờ hỏng thì cả bộ đỏ chứ không âm thầm bỏ qua.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Chọn cảm xúc: rê chuột từ tim lên hàng không làm nó biến mất";

const TITLE = "E2E hover cảm xúc";
const PICKER = '[role="dialog"][aria-label="Chọn cảm xúc"]';

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, {
    width: 1280, height: 900,
    // 2 = hover, 4 = fine. Không có cờ này thì app coi máy là màn cảm ứng.
    extraArgs: ["--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4"],
  });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });

  try {
    const me = await signIn(page, base, db);
    await db.collection("memories").deleteMany({ title: TITLE });
    await db.collection("memories").insertOne({
      spaceId: me.spaceId, title: TITLE, photos: [], embeds: [], tags: [], mentions: [],
      date: new Date(), createdBy: me.uid, createdAt: new Date(), updatedAt: new Date(),
    });

    await page.viewport(1280, 900, false);
    await page.goto(`${base}/timeline`);
    await page.until(`document.readyState === "complete"`, { timeout: 60000 }).catch(() => {});

    const capable = await page.eval(`matchMedia("(hover: hover) and (pointer: fine)").matches ? "1" : "0"`);
    ok("trình duyệt của bài kiểm thật sự có hover", capable === "1",
       capable === "1" ? "" : "cờ blink-settings không ăn — mọi bài dưới đây sẽ vô nghĩa");
    if (capable !== "1") return results;

    await page.until(`!!document.querySelector('[aria-label="Thả tim"],[aria-label^="Bỏ cảm xúc"]')`, { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 600));

    const heart = JSON.parse(await page.eval(`(() => {
      const b = document.querySelector('[aria-label="Thả tim"],[aria-label^="Bỏ cảm xúc"]');
      const r = b.getBoundingClientRect();
      return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
    })()`));

    const move = async (x, y) => {
      await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
      await new Promise((r) => setTimeout(r, 120));
    };
    const alive = () => page.eval(`!!document.querySelector('${PICKER}') ? "1" : "0"`);

    await move(heart.x, heart.y);
    await new Promise((r) => setTimeout(r, 500));
    ok("trỏ vào trái tim thì hàng cảm xúc mở ra", (await alive()) === "1");

    const bar = JSON.parse(await page.eval(`(() => {
      const d = document.querySelector('${PICKER}');
      if (!d) return "null";
      const r = d.getBoundingClientRect();
      return JSON.stringify({ x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom });
    })()`));
    if (!bar) return results;

    /*
     * Đi từng bước nhỏ, đúng như tay người — không nhảy một phát vào giữa bar.
     * Cú nhảy sẽ qua được kể cả khi cây cầu hỏng, vì nó không bao giờ dừng lại
     * trong vùng chết.
     */
    const steps = 10;
    const dead = [];
    for (let i = 1; i <= steps; i++) {
      await move(heart.x + ((bar.x + bar.w / 2 - heart.x) * i) / steps,
                 heart.y + ((bar.y + bar.h / 2 - heart.y) * i) / steps);
      if ((await alive()) !== "1") dead.push(i);
    }
    ok("hàng cảm xúc sống suốt quãng đường từ tim lên", dead.length === 0,
       dead.length ? `tắt ở bước ${dead.join(",")} trên ${steps}` : "");

    // Đứng yên trên hàng lâu hơn hẹn giờ đóng (260ms): vẫn phải còn.
    await new Promise((r) => setTimeout(r, 900));
    ok("đứng yên trên hàng cảm xúc thì nó không tự tắt", (await alive()) === "1");
    if (shotDir) await page.shot(`${shotDir}/reaction-hover.png`);

    // Và rời hẳn đi thì phải đóng — nếu không thì "sửa" thành ra kẹt luôn.
    await move(heart.x, heart.y + 260);
    await new Promise((r) => setTimeout(r, 900));
    ok("rời hẳn ra thì hàng cảm xúc đóng lại", (await alive()) === "0");
  } finally {
    await db.collection("memories").deleteMany({ title: TITLE }).catch(() => {});
    page.close();
    chrome.kill();
  }
  return results;
}
