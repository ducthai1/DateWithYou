/*
 * Sổ tay: ghi chú + lịch theo ngày, cả hai người cùng dùng.
 *
 * Dữ liệu cố ý XẤU (luật của kho: test UI chỉ có dữ liệu đẹp thì không phải
 * test UI): một ô 500 ký tự liền không dấu cách, một URL dán vào ô, emoji ghép,
 * nhãn ngày 40 ký tự liền, tên cột 24 ký tự liền, nhãn 1 ký tự. Đo tràn ngang
 * trên ĐÚNG hộp cuộn của trang.
 *
 * Bố cục từ 28/10 (chủ repo: "khó dùng, gò bó"): thẻ một ngày lật được ‹ ›,
 * kế hoạch theo TUẦN (thẻ dọc trên điện thoại, bảng trên máy tính), một khung
 * sửa cả ngày (chép / đổi ngày), khung Tuỳ chỉnh (cột, chỉ số, khoảng ngày).
 * Làm như người dùng — và RELOAD để chắc mọi thứ nằm ở máy chủ.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Sổ tay: ngày lật được, kế hoạch theo tuần, sửa cả ngày, chép/đổi ngày, tuỳ chỉnh — dữ liệu xấu, qua reload";

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
 * Page-level sideways overflow: the document and PageShell's scroll box — the
 * one with overflow-x HIDDEN. An `overflow-x:auto` strip (the notes' tabs)
 * computes overflow-y to auto too and would pass for the page if picked by that.
 */
const PAGE_OVERFLOW = `(() => {
  const boxes = [...document.querySelectorAll("div")].filter((d) => {
    const s = getComputedStyle(d);
    return s.overflowY === "auto" && s.overflowX === "hidden" && d.querySelector("[data-week]");
  });
  const page = boxes.pop();
  const doc = document.documentElement;
  return JSON.stringify({
    page: page ? page.scrollWidth - page.clientWidth : -1,
    doc: doc.scrollWidth - doc.clientWidth,
  });
})()`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dm = (date) => `${Number(date.slice(8, 10))}/${Number(date.slice(5, 7))}`;
const clickButton = (text, scope = "document") =>
  `(() => { const b = [...${scope}.querySelectorAll("button")].find((x) => x.textContent.trim().includes(${JSON.stringify(text)}) && !x.disabled); if (!b) return false; b.click(); return true; })()`;
const setField = (sel, value) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return false;
  const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
})()`;
const dayChecks = `[...document.querySelectorAll('[role="checkbox"]')]`;
const dayTitle = `(document.querySelector("h2.text-center")?.textContent ?? "")`;

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 390, height: 844 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });
  let spaceId = null;
  const { Types } = (await import("mongoose")).default;

  try {
    await page.viewport(390, 844, true, 2);
    const session = await signIn(page, base, db);
    spaceId = session.spaceId;
    const { id, today } = await seed(db, spaceId, session.uid);
    const stored = () => db.collection("notebooks").findOne({ _id: Types.ObjectId.createFromHexString(id) });
    const tomorrow = shift(today, 1);
    const yesterday = shift(today, -1);

    for (const [label, w, h, mobile] of [["390", 390, 844, true], ["1440", 1440, 900, false]]) {
      await page.viewport(w, h, mobile, mobile ? 2 : 1);
      await page.goto(`${base}/so-tay?so=${id}`);
      const shown = await page.until(`document.querySelectorAll("[data-week]").length > 0 && ${dayTitle}.includes("Hôm nay")`, { timeout: 60000 })
        .then(() => true).catch(() => false);
      ok(`${label}: thẻ ngày (đang ở hôm nay) và kế hoạch theo tuần hiện ra`, shown);
      if (!shown) continue;
      await sleep(800);
      const o = JSON.parse(await page.eval(PAGE_OVERFLOW));
      ok(`${label}: trang không tràn ngang với dữ liệu xấu`, o.page <= 1 && o.doc <= 1, JSON.stringify(o));
      // This week is open, and today is marked in it — as a card on a phone, a table row on a computer.
      const marked = await page.eval(mobile
        ? `[...document.querySelectorAll("[data-week] li button")].some((b) => b.offsetParent && b.textContent.includes("Hôm nay"))`
        : `!!document.querySelector('tr[aria-current="date"]')?.offsetParent`);
      ok(`${label}: tuần này mở sẵn, hôm nay được đánh dấu`, marked);
      if (shotDir) await page.shot(`${shotDir}/so-tay-${label}.png`);
    }

    await page.viewport(390, 844, true, 2);
    await page.goto(`${base}/so-tay?so=${id}`);
    await page.until(`${dayChecks}.length > 0`, { timeout: 60000 });

    // ── Tick ở thẻ ngày, qua reload ────────────────────────────────────────
    await page.until(`(() => { const b = ${dayChecks}[0]; if (b.getAttribute("aria-checked") === "true") return true; b.click(); return false; })()`, { timeout: 20000 });
    await sleep(1200);
    await reload(page);
    const ticked = await page.until(`${dayChecks}[0]?.getAttribute("aria-checked") === "true"`, { timeout: 45000 }).then(() => true).catch(() => false);
    ok("tick bữa đầu tiên của hôm nay còn nguyên sau reload", ticked);
    let doc = await stored();
    ok("…và nằm ở máy chủ", doc.days.find((d) => d.date === today).cells.find((c) => c.slot === "trua").done === true);

    // ── Lật sang ngày mai, qua reload ──────────────────────────────────────
    await page.eval(`document.querySelector('[aria-label="Ngày sau"]').click()`);
    const onTomorrow = await page.until(`${dayTitle}.includes("Ngày mai") && location.search.includes("ngay=${tomorrow}")`, { timeout: 10000 }).then(() => true).catch(() => false);
    await reload(page);
    const stillTomorrow = await page.until(`${dayTitle}.includes("Ngày mai")`, { timeout: 45000 }).then(() => true).catch(() => false);
    ok("lật sang ngày mai bằng ›, tải lại vẫn ở ngày mai", onTomorrow && stillTomorrow);

    // ── Sửa cả ngày mai trong một khung ────────────────────────────────────
    await page.eval(clickButton("Sửa ngày này"));
    await page.until(`!!document.querySelector('[role="dialog"]')`, { timeout: 10000 });
    await page.eval(setField('[role="dialog"] input[maxlength="40"]', "tập C mới"));
    await page.eval(setField(`[role="dialog"] textarea[aria-label^="Trưa 12h"]`, "300g ức gà + 1 chén cơm"));
    await page.eval(`document.querySelector('[role="dialog"] form').requestSubmit()`);
    await sleep(1500);
    await reload(page);
    await page.until(`${dayTitle}.includes("Ngày mai")`, { timeout: 45000 }).catch(() => {});
    doc = await stored();
    const t = doc.days.find((d) => d.date === tomorrow);
    const tileText = await page.eval(`document.body.innerText`);
    ok(
      "sửa nhãn + bữa trưa ngày mai trong một khung: lưu ở máy chủ, hiện sau reload",
      t.label === "tập C mới" && t.cells.find((c) => c.slot === "trua").text === "300g ức gà + 1 chén cơm" && tileText.includes("300g ức gà"),
      JSON.stringify({ label: t.label }),
    );

    // ── Chép ngày mai sang mọi ngày cùng thứ sau đó ─────────────────────────
    await page.eval(clickButton("Sửa ngày này"));
    await page.until(`!!document.querySelector('[role="dialog"]')`, { timeout: 10000 });
    await page.eval(clickButton("Chép sang ngày khác", `document.querySelector('[role="dialog"]')`));
    await page.until(`document.querySelector('[role="dialog"]').innerText.includes("Mọi ")`, { timeout: 10000 });
    await page.eval(clickButton("Mọi ", `document.querySelector('[role="dialog"]')`));
    await page.eval(clickButton("Chép sang", `document.querySelector('[role="dialog"] form')`));
    await sleep(1800);
    doc = await stored();
    const copies = doc.days.filter((d) => d.date > tomorrow && (new Date(d.date).getUTCDay() === new Date(tomorrow).getUTCDay()));
    ok(
      "chép sang mọi ngày cùng thứ sau đó: nhãn + chữ đi theo, không tick",
      copies.length > 0 && copies.every((d) => d.label === "tập C mới" && d.cells.find((c) => c.slot === "trua").text === "300g ức gà + 1 chén cơm" && d.cells.every((c) => !c.done)),
      `${copies.length} ngày`,
    );

    // ── Đổi ngày mai với hôm nay ───────────────────────────────────────────
    const beforeSwap = { today: doc.days.find((d) => d.date === today).label, tomorrow: doc.days.find((d) => d.date === tomorrow).label };
    await page.eval(clickButton("Sửa ngày này"));
    await page.until(`!!document.querySelector('[role="dialog"]')`, { timeout: 10000 });
    await page.eval(clickButton("Đổi với ngày khác", `document.querySelector('[role="dialog"]')`));
    await page.until(`!!document.querySelector('[aria-label="Ngày đổi với"]')`, { timeout: 10000 });
    await page.eval(`document.querySelector('[aria-label="Ngày đổi với"]').click()`);
    await sleep(300);
    // In the dropdown's own menu (a portal on <body>): the week's day cards start with the same "T4 28/10".
    await page.eval(`[...document.querySelectorAll("body > div.fixed.z-50 button")].find((b) => b.textContent.trim().startsWith(${JSON.stringify(`${["CN", "T2", "T3", "T4", "T5", "T6", "T7"][new Date(today + "T12:00:00Z").getUTCDay()]} ${dm(today)}`)}))?.click()`);
    await sleep(300);
    await page.eval(`document.querySelector('[role="dialog"] form').requestSubmit()`);
    await sleep(1800);
    doc = await stored();
    ok(
      "đổi cả ngày mai với hôm nay",
      doc.days.find((d) => d.date === today).label === beforeSwap.tomorrow && doc.days.find((d) => d.date === tomorrow).label === beforeSwap.today,
      JSON.stringify(beforeSwap),
    );

    // ── Cân: ghi lại ngày hôm qua, rồi xoá ─────────────────────────────────
    await page.goto(`${base}/so-tay?so=${id}&ngay=${yesterday}`);
    await page.until(`${dayTitle}.includes("Hôm qua")`, { timeout: 60000 });
    await page.eval(`[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Sửa" && b.closest("div")?.textContent.includes("ngày ${dm(yesterday)}"))?.click()`);
    await page.until(`!!document.getElementById("weigh-${yesterday}")`, { timeout: 10000 });
    await page.eval(setField(`#weigh-${yesterday}`, "60,9"));
    await page.eval(`document.getElementById("weigh-${yesterday}").form.requestSubmit()`);
    await sleep(1500);
    doc = await stored();
    ok("sửa số cân của hôm qua (không còn chỉ được cân 'sáng nay')", doc.metric.readings.find((r) => r.date === yesterday)?.value === 60.9);
    await page.eval(`document.querySelector("details summary").click()`);
    await page.eval(`document.querySelector('[aria-label="Sửa số ngày ${dm(yesterday)}"]').click()`);
    await sleep(300);
    await page.eval(clickButton("Xoá", "document.querySelector('details')"));
    await sleep(1500);
    doc = await stored();
    ok("xoá một lần cân trong bảng từng ngày", !doc.metric.readings.some((r) => r.date === yesterday));

    // ── Tuỳ chỉnh: thêm cột, đưa lên đầu; đổi chỉ số; qua reload ───────────
    // Every cell's text before, to prove the new column took nothing with it.
    const textsOf = (d) => JSON.stringify(d.days.map((x) => x.cells.filter((c) => c.slot !== "nuoc-uong").map((c) => [c.slot, c.text])));
    const textsBefore = textsOf(await stored());
    await page.goto(`${base}/so-tay?so=${id}`);
    await page.until(`${dayChecks}.length > 0`, { timeout: 60000 });
    await page.eval(`[...document.querySelectorAll("button")].find((b) => b.textContent.includes("Tuỳ chỉnh"))?.click()`);
    await page.until(`document.querySelector('[role="dialog"]')?.innerText.includes("Cột mỗi ngày")`, { timeout: 10000 });
    await page.eval(clickButton("Thêm cột", `document.querySelector('[role="dialog"]')`));
    const n = await page.eval(`document.querySelectorAll('[role="dialog"] input[aria-label^="Tên cột"]').length`);
    await page.eval(setField(`[role="dialog"] input[aria-label="Tên cột ${n}"]`, "Nước uống"));
    for (let i = n; i > 1; i--) await page.eval(`[...document.querySelectorAll('[role="dialog"] button[aria-label^="Đưa cột Nước uống lên"]')][0]?.click()`);
    await page.eval(setField('[role="dialog"] input[aria-label="Tên chỉ số"]', "Vòng eo"));
    await page.eval(setField('[role="dialog"] input[aria-label="Đơn vị"]', "cm"));
    await page.eval(`document.querySelector('[role="dialog"] form').requestSubmit()`);
    await sleep(2500);
    await reload(page);
    await page.until(`${dayChecks}.length > 0`, { timeout: 45000 }).catch(() => {});
    doc = await stored();
    const firstSlot = doc.slots[0]?.label;
    const allDaysHaveIt = doc.days.every((d) => d.cells[0]?.slot === doc.slots[0]?.key);
    const page2 = await page.eval(`document.body.innerText`);
    ok(
      "Tuỳ chỉnh: thêm cột Nước uống lên đầu — mọi ngày có ô mới, ô cũ còn nguyên",
      firstSlot === "Nước uống" && allDaysHaveIt && textsOf(doc) === textsBefore,
      JSON.stringify(doc.slots.map((s) => s.label)),
    );
    ok("…và đổi chỉ số sang Vòng eo, cm (hiện trên màn sau reload)", doc.metric.label === "Vòng eo" && doc.metric.unit === "cm" && page2.includes("Vòng eo"));

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
