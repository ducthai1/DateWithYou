/*
 * "Thêm dự định" ở /vault — bấm thay vì gõ.
 *
 * Chủ repo 02/11: "form này chưa hợp lý, nhiều nơi phải tự nghĩ tự nhập quá".
 * Form cũ là ba ô trống, phân loại cũng gõ tay; trên điện thoại thẻ không đổi
 * cột được vì kéo thả HTML5 không chạy trên màn cảm ứng. Bộ này làm như người
 * dùng: chọn gợi ý, để app đoán loại, chọn chỗ "Muốn đi", thêm thẳng vào cột,
 * chuyển cột bằng một chạm — rồi đọc lại database chứ không tin chữ trên màn.
 *
 * Dữ liệu cố ý xấu: tên quán dài, tiêu đề 120 ký tự liền không dấu cách, một
 * loại gõ tay từ trước khi có danh sách cố định.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Dự định (/vault): gợi ý bấm-là-điền, đoán loại, chỗ Muốn đi, + theo cột, chuyển cột một chạm — dữ liệu xấu";

const PLACE = "E2E kế hoạch — Quán cà phê có cái tên rất rất dài để xem chip có tràn khung hay không, chi nhánh Sài Gòn";
const LONG = "Dựđịnhcótiêuđềdàimộttrămhaimươikýtựliềnkhôngcódấucáchnàođểxemthẻcótrànracộthaykhôngvàchữcóxuốngdòngđượckhôngnhé".slice(0, 120);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function settles(check, timeout = 10000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await check()) return true;
    await sleep(200);
  }
  return false;
}

const inDialog = `document.querySelector('[role="dialog"]')`;
const chip = (text) => `[...(${inDialog}?.querySelectorAll("button[aria-pressed]") ?? [])].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
const pressed = (text) => `(${chip(text)})?.getAttribute("aria-pressed") === "true"`;
const click = (expr) => `(() => { const el = ${expr}; if (!el) return false; el.click(); return true; })()`;
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
/** The column a card sits in, by the heading of the section that holds it. */
const columnOf = (title) => `(() => {
  const h = [...document.querySelectorAll("section h4")].find((x) => x.textContent.trim() === ${JSON.stringify(title)});
  return h?.closest("section")?.querySelector("h3")?.textContent.trim() ?? null;
})()`;
/**
 * Sideways overflow where it matters: the document, PageShell's scroll box (the
 * one with overflow-x HIDDEN — the tab strip is overflow-x AUTO on purpose and
 * scrolls), and the widest any board column is pushed past its own box.
 */
const PAGE_OVERFLOW = `(() => {
  const page = [...document.querySelectorAll("div")].filter((d) => {
    const s = getComputedStyle(d);
    return s.overflowY === "auto" && s.overflowX === "hidden" && d.querySelector("section h4");
  }).pop();
  const doc = document.documentElement;
  const column = Math.max(0, ...[...document.querySelectorAll("section")].filter((x) => x.querySelector("h4")).map((x) => x.scrollWidth - x.clientWidth));
  return JSON.stringify({ page: page ? page.scrollWidth - page.clientWidth : -1, doc: doc.scrollWidth - doc.clientWidth, column });
})()`;
const submitDialog = `${inDialog}?.querySelector("form[data-plan-form]")?.requestSubmit()`;
const dialogGone = `!document.querySelector('[role="dialog"]')`;

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 390, height: 844 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });
  const plans = db.collection("roadmapplans");
  const planNamed = (title) => plans.findOne({ spaceId, title });
  let spaceId = null;

  try {
    await page.viewport(390, 844, true, 2);
    const session = await signIn(page, base, db);
    spaceId = session.spaceId;

    // The test space is the suite's own: start the board empty each run so
    // "already on the board" means what this run put there.
    await plans.deleteMany({ spaceId });
    await db.collection("locations").deleteMany({ spaceId, name: { $regex: "^E2E kế hoạch" } });
    const now = new Date();
    await db.collection("locations").insertOne({
      spaceId, name: PLACE, district: "Phường Sài Gòn", category: "Cà phê", status: "want_to_go",
      mustTry: "Bạc xỉu", source: "user", createdBy: session.uid, createdAt: now, updatedAt: now, __v: 0,
    });
    await plans.insertOne({
      spaceId, title: LONG, category: "cùng nhau", description: "y".repeat(400), status: "idea",
      createdBy: session.uid, createdAt: new Date(now.getTime() - 60_000), updatedAt: now, __v: 0,
    });

    const openBoard = async () => {
      await page.goto(`${base}/vault?tab=roadmap`);
      return page.until(`!!document.querySelector("section h4") && [...document.querySelectorAll("h3")].some((h) => h.textContent.includes("Đang lên kế hoạch"))`, { timeout: 90000 })
        .then(() => true).catch(() => false);
    };
    const openNew = async () => {
      await page.eval(clickButton("Thêm dự định"));
      return page.until(`!!${inDialog}?.querySelector("#plan-title")`, { timeout: 10000 }).then(() => true).catch(() => false);
    };
    const save = async () => {
      await page.eval(submitDialog);
      return page.until(dialogGone, { timeout: 15000 }).then(() => true).catch(() => false);
    };

    ok("bảng dự định hiện", await openBoard());

    // 1. A built-in idea: one tap fills the title and the kind.
    ok("form mở được", await openNew());
    const placeChip = await page.until(`!!${inDialog}?.querySelector("[data-plan-suggestions]") && [...${inDialog}.querySelectorAll("button")].some((b) => b.textContent.includes("E2E kế hoạch"))`, { timeout: 15000 })
      .then(() => true).catch(() => false);
    ok("gợi ý có chỗ \"Muốn đi\" của hai bạn", placeChip);
    const ideaCount = await page.eval(`${inDialog}.querySelectorAll("[data-plan-suggestions] button[aria-pressed]").length`);
    const saveReachable = await page.eval(`(() => {
      const d = ${inDialog}.getBoundingClientRect();
      const b = [...${inDialog}.querySelectorAll("button[type=submit]")][0]?.getBoundingClientRect();
      return !!b && b.bottom <= d.bottom + 1 && b.bottom <= innerHeight;
    })()`);
    ok("nút lưu nằm trong khung, không bị cắt", saveReachable);
    ok("gợi ý có sẵn ý tưởng để bấm", ideaCount >= 6, `${ideaCount} chip`);
    const kinds = await page.eval(`[...${inDialog}.querySelectorAll('[aria-label="Loại dự định"] button')].map((b) => b.textContent.trim()).join("|")`);
    ok("loại là chip, không phải ô gõ", kinds.startsWith("Du lịch|Ăn uống|Trải nghiệm|Mua sắm|Học cùng nhau|Tổ ấm"), kinds);
    ok("ghi chú gập lại, không chiếm chỗ", await page.eval(`!${inDialog}.querySelector("#plan-note")`));
    if (shotDir) await page.shot(`${shotDir}/vault-plan-form-390.png`);
    const dlgOverflow = await page.eval(`(() => { const d = ${inDialog}; return d.scrollWidth - d.clientWidth; })()`);
    ok("form không tràn ngang ở 390px, kể cả chip tên quán dài", dlgOverflow <= 0, `${dlgOverflow}px`);

    await page.eval(click(chip("Đi Đà Lạt")));
    await sleep(150);
    const filled = await page.eval(`document.querySelector("#plan-title").value`);
    ok("bấm \"Đi Đà Lạt\" là điền tiêu đề", filled === "Đi Đà Lạt", filled);
    ok("…và chọn luôn loại Du lịch", await page.eval(pressed("Du lịch")));
    ok("lưu được", await save());
    const daLat = await planNamed("Đi Đà Lạt");
    ok("database: Đi Đà Lạt · Du lịch · Ý tưởng", daLat?.category === "Du lịch" && daLat?.status === "idea", JSON.stringify(daLat && { c: daLat.category, s: daLat.status }));
    await page.until(`${columnOf("Đi Đà Lạt")} === "Ý tưởng"`, { timeout: 10000 }).catch(() => {});
    ok("thẻ hiện ở cột Ý tưởng", (await page.eval(columnOf("Đi Đà Lạt"))) === "Ý tưởng");

    // 2. Typing: the kind is guessed — until someone picks one, then it stays.
    await openNew();
    ok("ý đã có trên bảng không bị gợi ý lại", !(await page.eval(`!!(${chip("Đi Đà Lạt")})`)));
    await page.eval(setField("#plan-title", "Đi ăn lẩu"));
    await sleep(150);
    ok("gõ \"Đi ăn lẩu\" → tự chọn Ăn uống", await page.eval(pressed("Ăn uống")));
    await page.eval(click(chip("Học cùng nhau")));
    await page.eval(setField("#plan-title", "Đi ăn lẩu nướng Hội An"));
    await sleep(150);
    ok("đã tự chọn loại thì gõ tiếp không bị đoán đè", await page.eval(pressed("Học cùng nhau")) && !(await page.eval(pressed("Ăn uống"))));
    await page.eval(clickButton("Huỷ", inDialog));
    await page.until(dialogGone, { timeout: 5000 }).catch(() => {});

    // 3. A "Muốn đi" place: name, kind and where it is, from one tap.
    await openNew();
    await page.until(`[...${inDialog}.querySelectorAll("button")].some((b) => b.textContent.includes("E2E kế hoạch"))`, { timeout: 15000 }).catch(() => {});
    await page.eval(click(`[...${inDialog}.querySelectorAll("[data-plan-suggestions] button")].find((b) => b.textContent.includes("E2E kế hoạch"))`));
    await sleep(150);
    const note = await page.eval(`document.querySelector("#plan-note")?.value ?? null`);
    ok("chọn chỗ Muốn đi: ghi chú tự mở, có khu vực + món nên thử", note === "Ở Phường Sài Gòn. Món nên thử: Bạc xỉu.", String(note));
    ok("…loại Ăn uống (quán cà phê)", await page.eval(pressed("Ăn uống")));
    await save();
    const fromPlace = await planNamed(PLACE);
    ok("database: dự định từ chỗ Muốn đi", fromPlace?.category === "Ăn uống" && fromPlace?.description?.includes("Bạc xỉu"));

    // 4. The "+" on a column starts the card in that column.
    await page.eval(click(`document.querySelector('[aria-label="Thêm vào Đã làm"]')`));
    await page.until(`!!${inDialog}?.querySelector("#plan-title")`, { timeout: 10000 }).catch(() => {});
    ok("\"+\" ở cột Đã làm: form chọn sẵn Đã làm", await page.eval(pressed("Đã làm")));
    await page.eval(setField("#plan-title", "Đã đi Vũng Tàu"));
    await save();
    ok("database: vào thẳng cột Đã làm", (await planNamed("Đã đi Vũng Tàu"))?.status === "done");
    await page.until(`${columnOf("Đã đi Vũng Tàu")} === "Đã làm"`, { timeout: 10000 }).catch(() => {});
    ok("thẻ hiện ở cột Đã làm", (await page.eval(columnOf("Đã đi Vũng Tàu"))) === "Đã làm");

    // 5. One tap moves a card on — what the phone could not do before.
    await page.eval(click(`[...document.querySelectorAll("section h4")].find((h) => h.textContent.trim() === "Đi Đà Lạt")?.closest("[draggable]")?.querySelector("[data-plan-advance]")`));
    await page.until(`${columnOf("Đi Đà Lạt")} === "Đang lên kế hoạch"`, { timeout: 10000 }).catch(() => {});
    // The column changes optimistically, before the server has it — read the database until it does.
    ok("nút \"Lên kế hoạch →\" chuyển thẻ sang cột giữa", await settles(async () => (await planNamed("Đi Đà Lạt"))?.status === "planning"));

    // 6. Editing: no suggestions in the way, and the status row moves the card.
    await page.eval(click(`[...document.querySelectorAll("section h4")].find((h) => h.textContent.trim() === "Đi Đà Lạt")`));
    await page.until(`!!${inDialog}?.querySelector("#plan-title")`, { timeout: 10000 }).catch(() => {});
    ok("sửa: không hiện gợi ý", await page.eval(`!${inDialog}.querySelector("[data-plan-suggestions]")`));
    ok("sửa: trạng thái đang chọn đúng cột", await page.eval(pressed("Lên kế hoạch")));
    await page.eval(click(chip("Đã làm")));
    await save();
    ok("database: chọn Đã làm trong form là chuyển cột", await settles(async () => (await planNamed("Đi Đà Lạt"))?.status === "done"));

    // 7. A kind typed before the fixed list still has its chip.
    await page.eval(click(`[...document.querySelectorAll("section h4")].find((h) => h.textContent.trim() === ${JSON.stringify(LONG)})`));
    await page.until(`!!${inDialog}?.querySelector("#plan-title")`, { timeout: 10000 }).catch(() => {});
    ok("loại cũ \"cùng nhau\" vẫn có chip và đang được chọn", await page.eval(pressed("cùng nhau")));
    await page.eval(clickButton("Huỷ", inDialog));
    await page.until(dialogGone, { timeout: 5000 }).catch(() => {});

    // 8. Layout, both widths, with the 120-character title on the board.
    for (const [label, w, h, mobile] of [["390", 390, 844, true], ["1440", 1440, 900, false]]) {
      await page.viewport(w, h, mobile, mobile ? 2 : 1);
      await openBoard();
      await sleep(600);
      const o = JSON.parse(await page.eval(PAGE_OVERFLOW));
      ok(`bảng không tràn ngang ở ${label}px (tiêu đề 120 ký tự liền)`, o.page === 0 && o.doc === 0 && o.column === 0, JSON.stringify(o));
      if (shotDir) await page.shot(`${shotDir}/vault-plan-board-${label}.png`);
      if (shotDir && mobile) {
        await page.eval(`document.querySelector("section h4")?.closest("section")?.scrollIntoView({ block: "start" })`);
        await sleep(400);
        await page.shot(`${shotDir}/vault-plan-cards-${label}.png`);
      }
      if (!mobile) {
        await openNew();
        await sleep(400);
        if (shotDir) await page.shot(`${shotDir}/vault-plan-form-${label}.png`);
        await page.eval(clickButton("Huỷ", inDialog));
      }
    }
  } catch (e) {
    ok("không ném giữa chừng", false, String(e?.message ?? e).slice(0, 200));
  } finally {
    if (spaceId) {
      await plans.deleteMany({ spaceId });
      await db.collection("locations").deleteMany({ spaceId, name: { $regex: "^E2E kế hoạch" } });
    }
    page.close();
    chrome.kill();
  }
  return results;
}
