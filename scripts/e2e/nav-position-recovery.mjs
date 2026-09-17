/*
 * Bật định vị SAU khi đã bấm chỉ đường thì đường phải tự vẽ.
 *
 * Người dùng báo: bấm "Chỉ đường" lúc chưa bật định vị, bật lên sau, rồi
 * reload — tạm dừng — tiếp tục, kiểu gì cũng không có đường. Đúng như vậy:
 * nhánh lỗi ĐỊNH VỊ chỉ đặt một câu thông báo rồi dừng, trong khi nhánh lỗi
 * MẠNG ngay cạnh nó đã biết ghi lại "món nợ" và vẽ lại khi có mạng. Không ai
 * đánh thức yêu cầu đó nữa, nên chỉ còn cách bấm lại nút — giữa ngã tư.
 *
 * Bài kiểm chạy đúng kịch bản đó: KHÔNG cấp quyền vị trí, bấm chỉ đường, rồi
 * cấp quyền và **không chạm gì thêm**. Không có `click` nào sau khi cấp quyền
 * là phần quan trọng nhất của bài này.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Điều hướng: có định vị muộn thì đường tự vẽ";

const DEST = "E2E Đích Bật Định Vị Sau";

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 430, height: 930 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });
  let spaceId = null;

  try {
    await page.viewport(430, 930, true);
    const me = await signIn(page, base, db);
    spaceId = me.spaceId;
    await db.collection("locations").updateOne(
      { spaceId, name: DEST },
      {
        $set: {
          spaceId, name: DEST, district: "Phường Sài Gòn", category: "Cà phê",
          geo: { lat: 10.7869, lng: 106.7109 }, status: "want_to_go",
          createdBy: me.uid, createdAt: new Date(), updatedAt: new Date(),
        },
      },
      { upsert: true },
    );

    // Không có quyền vị trí, đúng như lúc người ta quên bật.
    await page.send("Browser.resetPermissions").catch(() => {});
    await page.goto(`${base}/map`);
    await page.until(`document.readyState === "complete"`, { timeout: 60000 }).catch(() => {});
    const hasBtn = await page
      .until(
        `[...document.querySelectorAll('button,a')].some(b => /Chỉ đường/.test(b.textContent||''))`,
        { timeout: 60000 },
      )
      .then(() => true)
      .catch(() => false);
    ok("có nút Chỉ đường để bấm", hasBtn === true);
    if (!hasBtn) return results;

    await page.eval(
      `[...document.querySelectorAll('button,a')].find(b => /Chỉ đường/.test(b.textContent||''))?.click()`,
    );
    const warned = await page
      .until(`/vị trí/.test(document.body.innerText)`, { timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    ok("chưa có định vị thì nói rõ, không im lặng", warned === true);
    const drawnTooEarly = await page.eval(`/Đường đã vẽ xong/.test(document.body.innerText)`);
    ok("…và chưa vẽ đường khi chưa biết mình ở đâu", drawnTooEarly === false);

    /* ——— bật định vị, rồi KHÔNG chạm gì nữa ——————————————————————— */
    await page.send("Browser.grantPermissions", { permissions: ["geolocation"] });
    await page.send("Emulation.setGeolocationOverride", {
      latitude: 10.7769, longitude: 106.7009, accuracy: 20,
    });
    const drew = await page
      .until(`/Đường đã vẽ xong/.test(document.body.innerText)`, { timeout: 40000 })
      .then(() => true)
      .catch(() => false);
    ok("bật định vị xong là đường TỰ vẽ, không phải bấm lại", drew === true);
    if (drew) {
      const shape = await page.eval(
        `(document.body.innerText.match(/Đường đã vẽ xong[^\\n]*/) || [""])[0]`,
      );
      ok("…và kèm quãng đường + thời gian thật", /km/.test(shape) && /phút/.test(shape), shape);
    }
    if (shotDir) await page.shot(`${shotDir}/nav-position-recovery.png`);
  } finally {
    if (spaceId) await db.collection("locations").deleteMany({ spaceId, name: DEST }).catch(() => {});
    page.close();
    chrome.kill();
  }
  return results;
}
