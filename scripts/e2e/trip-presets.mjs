/*
 * Chuyến đi: tạo bằng chip, chuẩn bị đồ bằng chip.
 *
 * Seed một dự định "Du lịch" trong Bí mật — chuyến đi thường là một dự định
 * thành thật. Bộ này: chọn dự định đó làm tên, bấm 3N2Đ, dời ngày đi (ngày về
 * phải dời theo, giữ 3 ngày), bấm 5tr ngân sách → lưu → database. Rồi vào tab
 * Hành trang, bấm ba món gợi ý thật nhanh (mỗi món đúng một lần), gõ một món
 * riêng trong lúc đó — ô gõ không bị xoá oan.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Chuyến đi: tên từ dự định Du lịch, chip 3N2Đ (dời ngày đi giữ độ dài), ngân sách 5tr, hành trang bấm-là-thêm không trùng";

const PLAN = "E2E Đi Phú Quốc";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const inDialog = `document.querySelector('[role="dialog"]')`;
const btn = (scope, text) => `[...(${scope}?.querySelectorAll("button") ?? [])].find((b) => b.textContent.replace(/\\s+/g, " ").trim() === ${JSON.stringify(text)})`;
const pressed = (scope, text) => `(${btn(scope, text)})?.getAttribute("aria-pressed") === "true"`;
const click = (expr) => `(() => { const el = ${expr}; if (!el) return false; el.click(); return true; })()`;
const setField = (sel, value) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return false;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
})()`;

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 390, height: 844 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });
  const trips = db.collection("trips");
  const plans = db.collection("roadmapplans");
  let spaceId = null;

  try {
    await page.viewport(390, 844, true, 2);
    const session = await signIn(page, base, db);
    spaceId = session.spaceId;
    await trips.deleteMany({ spaceId, title: PLAN });
    await plans.deleteMany({ spaceId, title: PLAN });
    await plans.insertOne({ spaceId, title: PLAN, category: "Du lịch", status: "idea", description: "Lặn ngắm san hô", createdBy: session.uid, createdAt: new Date(), updatedAt: new Date(), __v: 0 });

    await page.goto(`${base}/trips`);
    await page.until(`!!document.querySelector('[aria-label="Tạo chuyến đi mới"]')`, { timeout: 90000 });
    await sleep(500);
    await page.eval(`document.querySelector('[aria-label="Tạo chuyến đi mới"]').click()`);
    ok("form có chip từ dự định Du lịch", await page.until(`[...(${inDialog}?.querySelectorAll('[aria-label="Từ kế hoạch"] button') ?? [])].some((b) => b.textContent.includes(${JSON.stringify(PLAN)}))`, { timeout: 15000 }).then(() => true).catch(() => false));
    await page.eval(click(`[...${inDialog}.querySelectorAll('[aria-label="Từ kế hoạch"] button')].find((b) => b.textContent.includes(${JSON.stringify(PLAN)}))`));
    await sleep(150);
    ok("bấm dự định → tên chuyến + ghi chú", (await page.eval(`document.querySelector('input[aria-label="Tên chuyến đi"]').value`)) === PLAN
      && (await page.eval(`document.querySelector('textarea[aria-label="Mô tả chuyến đi"]').value`)) === "Lặn ngắm san hô");

    await page.eval(click(btn(inDialog, "3N2Đ")));
    await sleep(150);
    ok("chip 3N2Đ được chọn", await page.eval(pressed(inDialog, "3N2Đ")));
    // Move the start a day later through the picker: the end must follow, still three days.
    await page.eval(`document.querySelector('[aria-label="Ngày bắt đầu"]').click()`);
    await sleep(300);
    const moved = await page.eval(`(() => {
      const cells = [...document.querySelectorAll("body > div.fixed button, [role='dialog'] button")].filter((b) => /^\\d{1,2}$/.test(b.textContent.trim()) && !b.disabled);
      const sel = cells.find((b) => b.getAttribute("aria-pressed") === "true" || b.getAttribute("aria-selected") === "true" || b.className.includes("bg-accent "));
      const i = cells.indexOf(sel);
      if (i < 0 || !cells[i + 1]) return false;
      cells[i + 1].click();
      return true;
    })()`);
    await sleep(300);
    ok("dời ngày đi → vẫn 3N2Đ (ngày về dời theo)", moved && (await page.eval(pressed(inDialog, "3N2Đ"))));

    await page.eval(click(btn(inDialog, "5tr")));
    await sleep(150);
    ok("chip 5tr → 5.000.000", (await page.eval(`document.querySelector('input[aria-label="Ngân sách dự kiến"]').value`)) === "5.000.000");
    if (shotDir) await page.shot(`${shotDir}/trip-form-presets-390.png`);
    const over = await page.eval(`(() => { const d = ${inDialog}; return d.scrollWidth - d.clientWidth; })()`);
    ok("form không tràn ngang ở 390px", over <= 0, `${over}px`);
    await page.eval(`${inDialog}.querySelector("form").requestSubmit()`);
    let trip = null;
    for (let i = 0; i < 40 && !trip; i++) { trip = await trips.findOne({ spaceId, title: PLAN }); if (!trip) await sleep(250); }
    const days = trip ? (Date.parse(trip.endDate) - Date.parse(trip.startDate)) / 86400000 + 1 : 0;
    ok("database: 3 ngày, ngân sách 5.000.000", !!trip && days === 3 && trip.budget === 5_000_000, JSON.stringify(trip && { s: trip.startDate, e: trip.endDate, b: trip.budget }));

    // Packing: three quick taps, each lands once; typing meanwhile survives.
    await page.goto(`${base}/trips/${trip._id}?tab=checklist`);
    await page.until(`!!document.querySelector("[data-packing-ideas]")`, { timeout: 60000 }).catch(() => {});
    await page.eval(setField('input[aria-label="Thêm mục cần chuẩn bị"]', "Máy ảnh film"));
    for (const item of ["Sạc dự phòng", "Kem chống nắng", "Đồ bơi"]) {
      await page.eval(click(`[...document.querySelectorAll("[data-packing-ideas] button")].find((b) => b.textContent.trim() === ${JSON.stringify(item)})`));
    }
    let list = [];
    for (let i = 0; i < 40; i++) {
      list = ((await trips.findOne({ _id: trip._id }))?.checklists ?? []).map((c) => c.content);
      if (list.length >= 3) break;
      await sleep(250);
    }
    await sleep(800);
    list = ((await trips.findOne({ _id: trip._id }))?.checklists ?? []).map((c) => c.content);
    ok("ba lần bấm nhanh → đúng ba món, không trùng", ["Sạc dự phòng", "Kem chống nắng", "Đồ bơi"].every((x) => list.filter((y) => y === x).length === 1), JSON.stringify(list));
    ok("ô đang gõ không bị xoá oan", (await page.eval(`document.querySelector('input[aria-label="Thêm mục cần chuẩn bị"]').value`)) === "Máy ảnh film");
    const added = JSON.stringify(["Sạc dự phòng", "Kem chống nắng", "Đồ bơi"]);
    await page.until(`document.body.innerText.includes("0/3 mục")`, { timeout: 15000 }).catch(() => {});
    ok("danh sách hiện đủ ba món", await page.eval(`document.body.innerText.includes("0/3 mục")`));
    ok("cả ba món đã thêm đều biến khỏi gợi ý", await page.eval(`!${added}.some((x) => [...document.querySelectorAll("[data-packing-ideas] button")].some((b) => b.textContent.trim() === x))`));
    if (shotDir) await page.shot(`${shotDir}/trip-packing-390.png`);
  } catch (e) {
    ok("không ném giữa chừng", false, String(e?.message ?? e).slice(0, 200));
  } finally {
    if (spaceId) {
      await trips.deleteMany({ spaceId, title: PLAN });
      await plans.deleteMany({ spaceId, title: PLAN });
    }
    page.close();
    chrome.kill();
  }
  return results;
}
