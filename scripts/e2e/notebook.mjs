/*
 * Sổ tay: ghi chú + lịch theo ngày, cả hai người cùng dùng.
 *
 * Dữ liệu cố ý XẤU (luật của kho: test UI chỉ có dữ liệu đẹp thì không phải
 * test UI): một ô 500 ký tự liền không dấu cách, một URL dán vào ô, emoji ghép,
 * nhãn ngày 40 ký tự liền, tên cột 24 ký tự liền, nhãn 1 ký tự. Đo tràn ngang
 * trên ĐÚNG hộp cuộn của trang — bảng thì được phép cuộn ngang trong khung riêng
 * của nó, còn trang thì không bao giờ.
 *
 * Rồi làm như người dùng: tick một bữa, đổi chỗ hai ô, nhập cân, chuyển mục —
 * và RELOAD để chắc mọi thứ nằm ở máy chủ chứ không chỉ trên màn.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Sổ tay: hôm nay + bảng cả đợt, dữ liệu xấu, tick/đổi ô/cân qua reload";

const MARK = "E2E sổ tay";
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shift = (key, n) => {
  const [y, m, d] = key.split("-").map(Number);
  return keyOf(new Date(y, m - 1, d + n, 12));
};

async function seed(db, spaceId, uid) {
  await db.collection("notebooks").deleteMany({ spaceId, title: { $regex: `^${MARK}` } });
  const today = keyOf(new Date());
  const slots = [
    { key: "trua", label: "Trưa 12h" },
    { key: "phu", label: "Bữaphụ17h30rấtdàikhôngcách".slice(0, 24) },
    { key: "toi", label: "Tối 19h30" },
    { key: "tap", label: "T" },
  ];
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = shift(today, i - 3);
    const cells = {
      trua: `230g bắp bò + 150g đậu hũ + rau luộc (ngày ${i + 1})`,
      phu: i === 3 ? "x".repeat(500) : i === 4 ? "https://www.example.com/mot/duong/dan/rat/dai/khong/co/cho/xuong/dong?q=1" : "",
      toi: i === 3 ? "👩‍❤️‍👨🏸🇻🇳 ức gà 220g" : `Tối ${i + 1}: 250g cá rô phi hấp`,
      tap: i % 2 ? "Buổi A" : "",
    };
    return {
      date,
      label: i === 3 ? "nhãnrấtdàikhôngcódấucáchnàocảđểxemtràn".slice(0, 40) : i === 5 ? "C" : "",
      cells: slots.map((s) => ({ slot: s.key, text: cells[s.key], done: false })),
    };
  });
  const res = await db.collection("notebooks").insertOne({
    spaceId,
    title: `${MARK} — Siết cân thử với một cái tên khá dài để xem tiêu đề xuống dòng`,
    slots,
    days,
    sections: [
      { key: "ghi-chu", title: "Ghi chú", body: "Dòng một\nDòng hai\n" + "y".repeat(300) },
      { key: "di-cho", title: "Đi chợ", body: "Ức gà 850g\nTôm 500g" },
    ],
    metric: {
      label: "Cân",
      unit: "kg",
      readings: [
        { date: shift(today, -3), value: 61 },
        { date: shift(today, -2), value: 60.7 },
        { date: shift(today, -1), value: 60.6 },
      ],
      targets: [
        { date: shift(today, 3), value: 59.7 },
        { date: shift(today, 10), value: 58 },
      ],
    },
    createdBy: uid,
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0,
  });
  return { id: String(res.insertedId), today };
}

async function reload(page) {
  const loaded = page.waitForEvent("Page.loadEventFired", 60000);
  await page.send("Page.reload");
  await loaded.catch(() => {});
}

/**
 * Page-level sideways overflow: the document and PageShell's scroll box — not
 * the table's own frame. PageShell's box is the one with overflow-x HIDDEN.
 * Picking "the deepest overflow-y:auto box" got the table frame instead: an
 * `overflow-x:auto` element computes overflow-y to auto as well, so it looked
 * like a page scroller and reported the table's intended 420px as a bug.
 */
const PAGE_OVERFLOW = `(() => {
  const boxes = [...document.querySelectorAll("div")].filter((d) => {
    const s = getComputedStyle(d);
    return s.overflowY === "auto" && s.overflowX === "hidden" && d.querySelector("table");
  });
  const page = boxes.pop();
  const doc = document.documentElement;
  return JSON.stringify({
    page: page ? page.scrollWidth - page.clientWidth : -1,
    doc: doc.scrollWidth - doc.clientWidth,
  });
})()`;

const todayChecks = `[...document.querySelectorAll('[role="checkbox"]')]`;

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 390, height: 844 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });
  let spaceId = null;

  try {
    await page.viewport(390, 844, true, 2);
    const session = await signIn(page, base, db);
    spaceId = session.spaceId;
    const { id, today } = await seed(db, spaceId, session.uid);

    for (const [label, w, h, mobile] of [["390", 390, 844, true], ["1440", 1440, 900, false]]) {
      await page.viewport(w, h, mobile, mobile ? 2 : 1);
      await page.goto(`${base}/so-tay?so=${id}`);
      const shown = await page.until(`!!document.querySelector("table") && document.body.innerText.includes("Hôm nay")`, { timeout: 60000 })
        .then(() => true).catch(() => false);
      ok(`${label}: thẻ Hôm nay và bảng cả đợt hiện ra`, shown);
      if (!shown) continue;
      await new Promise((r) => setTimeout(r, 800));
      const o = JSON.parse(await page.eval(PAGE_OVERFLOW));
      ok(`${label}: trang không tràn ngang với dữ liệu xấu`, o.page <= 1 && o.doc <= 1, JSON.stringify(o));
      const todayRow = await page.eval(`document.querySelector('tr[aria-current="date"] th')?.innerText ?? ""`);
      ok(`${label}: hàng hôm nay được đánh dấu`, todayRow.includes("Hôm nay"), todayRow.replace(/\s+/g, " "));
      if (shotDir) {
        await page.shot(`${shotDir}/so-tay-${label}.png`);
        // The lower half is where the table, the chart and the notes live.
        for (const [part, sel] of [["bang", "table"], ["bieu-do", 'svg[role="img"]'], ["ghi-chu", '[role="tablist"]']]) {
          const moved = await page.eval(`(() => {
            const el = document.querySelector(${JSON.stringify(sel)});
            const box = [...document.querySelectorAll("div")].filter((d) => {
              const s = getComputedStyle(d);
              return s.overflowY === "auto" && s.overflowX === "hidden" && el && d.contains(el);
            }).pop();
            if (!el || !box) return false;
            box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top - 72;
            return true;
          })()`);
          if (moved) {
            await new Promise((r) => setTimeout(r, 300));
            await page.shot(`${shotDir}/so-tay-${label}-${part}.png`);
          }
        }
      }
    }

    await page.viewport(390, 844, true, 2);
    await page.goto(`${base}/so-tay?so=${id}`);
    await page.until(`${todayChecks}.length > 0`, { timeout: 60000 });

    // ── Tick ở thẻ Hôm nay, qua reload ────────────────────────────────────
    await page.until(`(() => { const b = ${todayChecks}[0]; if (b.getAttribute("aria-checked") === "true") return true; b.click(); return false; })()`, { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1200));
    await reload(page);
    const ticked = await page.until(`${todayChecks}[0]?.getAttribute("aria-checked") === "true"`, { timeout: 45000 }).then(() => true).catch(() => false);
    ok("tick bữa đầu tiên của hôm nay còn nguyên sau reload", ticked);
    const stored = await db.collection("notebooks").findOne({ _id: (await import("mongoose")).default.Types.ObjectId.createFromHexString(id) });
    const cell = stored.days.find((d) => d.date === today).cells.find((c) => c.slot === "trua");
    ok("…và nằm ở máy chủ", cell.done === true);

    // ── Đổi ô: Tối hôm nay ↔ Tối ngày mai ──────────────────────────────────
    // Match the row by the END of its first line ("T6 23/10"): `includes("3/10")` would also hit 23/10.
    const dm = (date) => `${Number(date.slice(8, 10))}/${Number(date.slice(5, 7))}`;
    const cellBtn = (date, slot) => `[...document.querySelectorAll("tbody tr")].find((tr) => (tr.querySelector("th")?.innerText ?? "").split("\\n")[0].endsWith(" ${dm(date)}"))?.querySelectorAll("td button")[${slot}]`;
    const tomorrow = shift(today, 1);
    // Today is day 4 of the seed (index 3) — the emoji cell; tomorrow is day 5.
    const before = { a: "👩‍❤️‍👨🏸🇻🇳 ức gà 220g", b: "Tối 5: 250g cá rô phi hấp" };
    await page.eval(`${cellBtn(today, 2)}.click()`);
    await page.until(`!!document.querySelector('[role="dialog"]')`, { timeout: 10000 });
    await page.eval(`[...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.includes("Đổi chỗ"))?.click()`);
    await page.until(`document.body.innerText.includes("Chạm vào ô muốn đổi chỗ")`, { timeout: 10000 });
    await page.eval(`${cellBtn(tomorrow, 2)}.click()`);
    await new Promise((r) => setTimeout(r, 1500));
    await reload(page);
    await page.until(`!!document.querySelector("tbody tr")`, { timeout: 45000 });
    const after = await page.eval(`JSON.stringify({ a: ${cellBtn(today, 2)}?.innerText, b: ${cellBtn(tomorrow, 2)}?.innerText })`);
    const swapped = JSON.parse(after);
    ok("đổi chỗ Tối hôm nay với Tối ngày mai, còn nguyên sau reload", swapped.a === before.b && swapped.b === before.a, after);

    // ── Cân sáng nay ───────────────────────────────────────────────────────
    const dots = `document.querySelectorAll("svg circle.fill-accent").length`;
    // The chart draws after it has measured its width — count once it has.
    await page.until(`${dots} > 0`, { timeout: 20000 }).catch(() => {});
    const dotsBefore = await page.eval(dots);
    await page.eval(`(() => { const i = document.getElementById("weigh-in"); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, "60,4"); i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
    await page.eval(`document.getElementById("weigh-in").form.requestSubmit()`);
    await page.until(`document.body.innerText.includes("60,4")`, { timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1200));
    await reload(page);
    // Wait for the chart's own dots: lucide icons are SVGs with <circle>s too.
    await page.until(`${dots} > 0`, { timeout: 45000 }).catch(() => {});
    const dotsAfter = await page.eval(dots);
    const shows = await page.eval(`document.body.innerText.includes("sáng nay") && document.body.innerText.includes("60,4")`);
    ok("nhập cân 60,4: hiện ở thẻ Hôm nay và thêm một chấm trên biểu đồ, qua reload", shows && dotsAfter === dotsBefore + 1, `chấm ${dotsBefore} → ${dotsAfter}`);

    // ── Mục ghi chú: chuyển tab, qua reload ────────────────────────────────
    await page.until(`(() => { if (location.search.includes("muc=di-cho")) return true;
      [...document.querySelectorAll('[role="tab"]')].find((t) => t.textContent.includes("Đi chợ"))?.click(); return false; })()`, { timeout: 20000 });
    await reload(page);
    const sectionKept = await page.until(`[...document.querySelectorAll('[role="tab"]')].find((t) => t.getAttribute("aria-selected") === "true")?.textContent?.includes("Đi chợ") && document.body.innerText.includes("Tôm 500g")`, { timeout: 45000 }).then(() => true).catch(() => false);
    ok("mục Đi chợ vẫn mở sau reload", sectionKept);
    if (shotDir) await page.shot(`${shotDir}/so-tay-390-after.png`);
  } finally {
    if (spaceId) await db.collection("notebooks").deleteMany({ spaceId, title: { $regex: `^${MARK}` } }).catch(() => {});
    page.close();
    chrome.kill();
  }
  return results;
}
