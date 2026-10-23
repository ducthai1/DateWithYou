/*
 * Sổ tay: ghi chú + lịch theo ngày, của chung hai người.
 *
 * Thứ đáng giữ ở đây là những chỗ sai sẽ IM LẶNG: một ô ghi đè ô của người kia,
 * một cú đổi ô làm rơi dấu tick, một lần ghi nhắm vào ngày không có mà vẫn báo
 * thành công, và giới hạn bị vượt khi hai người cùng bấm.
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, closeDatabase, makeCouple, makeMember, must, rejects } from "./_harness.ts";
import { NOTEBOOK_LIMITS } from "@/lib/notebook";

let couple: Awaited<ReturnType<typeof makeCouple>>;
let outsider: Awaited<ReturnType<typeof makeMember>>;

before(async () => {
  await freshDatabase();
  couple = await makeCouple({ a: "An", b: "Binh" });
  outsider = await makeMember({ name: "Chi", spaceName: "Góc khác" });
});
after(closeDatabase);

const newBook = async (slots = ["Trưa 12h", "Tối 19h30", "Tập"]) =>
  (await couple.a.caller.notebook.create({ title: "Siết cân", start: "2026-10-23", end: "2026-10-29", slots })).id;
const read = (id: string) => couple.a.caller.notebook.get({ id });
const cell = (book: Awaited<ReturnType<typeof read>>, date: string, slot: string) =>
  must(book.days.find((d) => d.date === date), `day ${date}`).cells[slot];

describe("tạo sổ", () => {
  test("mỗi ngày trong khoảng một hàng, mỗi cột một ô trống, có sẵn mục Ghi chú", async () => {
    const book = await read(await newBook());
    assert.equal(book.days.length, 7);
    assert.equal(book.days[0].date, "2026-10-23");
    assert.equal(book.days[6].date, "2026-10-29");
    assert.deepEqual(book.slots.map((s) => s.key), ["trua-12h", "toi-19h30", "tap"]);
    for (const d of book.days) assert.deepEqual(Object.keys(d.cells), ["trua-12h", "toi-19h30", "tap"]);
    assert.deepEqual(cell(book, "2026-10-25", "tap"), { text: "", done: false });
    assert.deepEqual(book.sections.map((s) => s.title), ["Ghi chú"]);
  });

  test("hai cột trùng tên vẫn là hai cột", async () => {
    const book = await read(await newBook(["Bữa phụ", "Bữa phụ"]));
    assert.deepEqual(book.slots.map((s) => s.key), ["bua-phu", "bua-phu-2"]);
  });

  test("khoảng ngày ngược hoặc dài quá giới hạn thì từ chối", async () => {
    const make = (start: string, end: string) =>
      couple.a.caller.notebook.create({ title: "x", start, end, slots: ["Trưa"] });
    await rejects(() => make("2026-10-29", "2026-10-23"), "BAD_REQUEST");
    await rejects(() => make("2026-01-01", "2026-12-31"), "BAD_REQUEST");
    const ok = await read((await make("2026-01-01", "2026-04-30")).id);
    assert.equal(ok.days.length, NOTEBOOK_LIMITS.days, "đúng 120 ngày là vừa giới hạn");
  });
});

describe("từng ô", () => {
  test("ghi chữ và tick một ô không đụng ô khác", async () => {
    const id = await newBook();
    await couple.a.caller.notebook.setCell({ id, date: "2026-10-23", slot: "trua-12h", text: "  230g bắp bò  " });
    await couple.a.caller.notebook.toggleCell({ id, date: "2026-10-23", slot: "trua-12h", done: true });
    const book = await read(id);
    assert.deepEqual(cell(book, "2026-10-23", "trua-12h"), { text: "230g bắp bò", done: true });
    assert.deepEqual(cell(book, "2026-10-23", "toi-19h30"), { text: "", done: false });
    assert.deepEqual(cell(book, "2026-10-24", "trua-12h"), { text: "", done: false });
  });

  test("hai người sửa hai ô CÙNG lúc thì cả hai đều còn", async () => {
    const id = await newBook();
    await Promise.all([
      couple.a.caller.notebook.setCell({ id, date: "2026-10-24", slot: "trua-12h", text: "của An" }),
      couple.b.caller.notebook.setCell({ id, date: "2026-10-24", slot: "toi-19h30", text: "của Bình" }),
      couple.b.caller.notebook.toggleCell({ id, date: "2026-10-24", slot: "tap", done: true }),
    ]);
    const book = await read(id);
    assert.equal(cell(book, "2026-10-24", "trua-12h").text, "của An");
    assert.equal(cell(book, "2026-10-24", "toi-19h30").text, "của Bình");
    assert.equal(cell(book, "2026-10-24", "tap").done, true);
  });

  test("ghi vào ngày hay cột không có thì báo NOT_FOUND, không im lặng", async () => {
    const id = await newBook();
    await rejects(() => couple.a.caller.notebook.setCell({ id, date: "2026-11-30", slot: "tap", text: "x" }), "NOT_FOUND");
    await rejects(() => couple.a.caller.notebook.toggleCell({ id, date: "2026-10-23", slot: "khong-co", done: true }), "NOT_FOUND");
  });

  test("ô dài hơn giới hạn bị từ chối", async () => {
    const id = await newBook();
    await rejects(
      () => couple.a.caller.notebook.setCell({ id, date: "2026-10-23", slot: "tap", text: "x".repeat(NOTEBOOK_LIMITS.cellText + 1) }),
      "BAD_REQUEST",
    );
  });

  test("nhãn ngày", async () => {
    const id = await newBook();
    await couple.a.caller.notebook.setDayLabel({ id, date: "2026-10-24", label: "cầu lông" });
    assert.equal(must((await read(id)).days.find((d) => d.date === "2026-10-24")).label, "cầu lông");
  });
});

describe("đổi ô", () => {
  test("đổi giữa hai ngày: chữ VÀ dấu tick đi theo", async () => {
    const id = await newBook();
    const n = couple.a.caller.notebook;
    await n.setCell({ id, date: "2026-10-23", slot: "toi-19h30", text: "ức gà" });
    await n.toggleCell({ id, date: "2026-10-23", slot: "toi-19h30", done: true });
    await n.setCell({ id, date: "2026-10-25", slot: "toi-19h30", text: "cá lóc" });
    await n.swapCells({ id, a: { date: "2026-10-23", slot: "toi-19h30" }, b: { date: "2026-10-25", slot: "toi-19h30" } });
    const book = await read(id);
    assert.deepEqual(cell(book, "2026-10-23", "toi-19h30"), { text: "cá lóc", done: false });
    assert.deepEqual(cell(book, "2026-10-25", "toi-19h30"), { text: "ức gà", done: true });
  });

  test("đổi hai ô trong cùng một ngày", async () => {
    const id = await newBook();
    const n = couple.a.caller.notebook;
    await n.setCell({ id, date: "2026-10-26", slot: "trua-12h", text: "trưa" });
    await n.setCell({ id, date: "2026-10-26", slot: "toi-19h30", text: "tối" });
    await n.swapCells({ id, a: { date: "2026-10-26", slot: "trua-12h" }, b: { date: "2026-10-26", slot: "toi-19h30" } });
    const book = await read(id);
    assert.equal(cell(book, "2026-10-26", "trua-12h").text, "tối");
    assert.equal(cell(book, "2026-10-26", "toi-19h30").text, "trưa");
  });

  test("đổi một ô với chính nó thì không gì thay đổi; ô không có thì NOT_FOUND", async () => {
    const id = await newBook();
    const n = couple.a.caller.notebook;
    await n.setCell({ id, date: "2026-10-27", slot: "tap", text: "Buổi B" });
    await n.swapCells({ id, a: { date: "2026-10-27", slot: "tap" }, b: { date: "2026-10-27", slot: "tap" } });
    assert.equal(cell(await read(id), "2026-10-27", "tap").text, "Buổi B");
    await rejects(
      () => n.swapCells({ id, a: { date: "2026-10-27", slot: "tap" }, b: { date: "2027-01-01", slot: "tap" } }),
      "NOT_FOUND",
    );
  });
});

describe("mục ghi chú", () => {
  test("thêm, sửa, xoá; khoá lấy từ tên và không trùng", async () => {
    const id = await newBook();
    const n = couple.a.caller.notebook;
    const { key } = await n.saveSection({ id, title: "Đi chợ", body: "Ức gà 850g" });
    assert.equal(key, "di-cho");
    const again = await n.saveSection({ id, title: "Đi chợ", body: "" });
    assert.equal(again.key, "di-cho-2");
    await n.saveSection({ id, key, title: "Đi chợ tuần 1", body: "Ức gà 1kg" });
    await n.removeSection({ id, key: again.key });
    const book = await read(id);
    assert.deepEqual(
      book.sections.map((s) => [s.title, s.body]),
      [["Ghi chú", ""], ["Đi chợ tuần 1", "Ức gà 1kg"]],
    );
  });

  test(`không quá ${NOTEBOOK_LIMITS.sections} mục`, async () => {
    const id = await newBook();
    for (let i = 1; i < NOTEBOOK_LIMITS.sections; i++)
      await couple.a.caller.notebook.saveSection({ id, title: `Mục ${i}`, body: "" });
    await rejects(() => couple.a.caller.notebook.saveSection({ id, title: "Thừa", body: "" }), "BAD_REQUEST");
  });
});

describe("cân mỗi sáng", () => {
  test("mỗi ngày một số: ghi lại thì thay, null thì xoá; mốc sắp theo ngày", async () => {
    const id = await newBook();
    const n = couple.a.caller.notebook;
    await n.logReading({ id, date: "2026-10-24", value: 60.6 });
    await n.logReading({ id, date: "2026-10-23", value: 61 });
    await n.logReading({ id, date: "2026-10-24", value: 60.4 });
    await n.logReading({ id, date: "2026-10-25", value: 60.1 });
    await n.logReading({ id, date: "2026-10-25", value: null });
    await n.setTargets({ id, targets: [{ date: "2026-11-11", value: 58 }, { date: "2026-10-28", value: 59.7 }] });
    const book = await read(id);
    assert.deepEqual(book.metric.readings, [{ date: "2026-10-23", value: 61 }, { date: "2026-10-24", value: 60.4 }]);
    assert.deepEqual(book.metric.targets.map((t) => t.date), ["2026-10-28", "2026-11-11"]);
    assert.equal(book.metric.label, "Cân");
  });

  test("số vô lý bị từ chối", async () => {
    const id = await newBook();
    for (const value of [0, -1, 1e6])
      await rejects(() => couple.a.caller.notebook.logReading({ id, date: "2026-10-23", value }), "BAD_REQUEST");
  });
});

describe("của chung hai người, kín với người ngoài", () => {
  test("người kia thấy và sửa được; người ngoài không đọc, không sửa được", async () => {
    const id = await newBook();
    assert.ok((await couple.b.caller.notebook.list()).some((b) => b.id === id));
    await couple.b.caller.notebook.rename({ id, title: "Sổ chung" });
    assert.equal((await read(id)).title, "Sổ chung");

    assert.ok(!(await outsider.caller.notebook.list()).some((b) => b.id === id));
    await rejects(() => outsider.caller.notebook.get({ id }), "NOT_FOUND");
    await rejects(() => outsider.caller.notebook.setCell({ id, date: "2026-10-23", slot: "tap", text: "x" }), "NOT_FOUND");
    await outsider.caller.notebook.remove({ id });
    assert.equal((await read(id)).title, "Sổ chung", "xoá từ space khác không được đụng tới sổ");
  });

  test("danh sách: khoảng ngày và số ngày", async () => {
    const id = await newBook();
    const row = must((await couple.a.caller.notebook.list()).find((b) => b.id === id));
    assert.deepEqual([row.start, row.end, row.dayCount], ["2026-10-23", "2026-10-29", 7]);
  });

  test("id bậy thì BAD_REQUEST chứ không vỡ thành 500", async () => {
    await rejects(() => couple.a.caller.notebook.get({ id: "khong-phai-id" }), "BAD_REQUEST");
  });
});
