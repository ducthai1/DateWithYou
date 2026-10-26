import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  chartRange,
  dayKeysBetween,
  dayProgress,
  focusDay,
  formatReading,
  parseReading,
  slotKeysFor,
  swapCells,
  type NotebookDay,
} from "@/lib/notebook";

/*
 * Sổ tay: những phần cả máy chủ lẫn màn hình cùng dựa vào. Lệch ở đây là hai
 * đầu hiểu khác nhau "ngày nào là hôm nay", "ô nào bị đổi".
 */

describe("khoảng ngày", () => {
  test("gồm cả hai đầu, qua tháng và qua năm không lệch", () => {
    assert.deepEqual(dayKeysBetween("2026-10-30", "2026-11-02"), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    assert.deepEqual(dayKeysBetween("2026-12-31", "2027-01-01"), ["2026-12-31", "2027-01-01"]);
    assert.deepEqual(dayKeysBetween("2026-10-23", "2026-10-23"), ["2026-10-23"]);
  });

  test("ngược chiều hoặc quá 120 ngày thì rỗng", () => {
    assert.deepEqual(dayKeysBetween("2026-10-24", "2026-10-23"), []);
    assert.equal(dayKeysBetween("2026-01-01", "2026-04-30").length, 120);
    assert.deepEqual(dayKeysBetween("2026-01-01", "2026-05-01"), []);
  });
});

describe("khoá cột", () => {
  test("lấy từ tên tiếng Việt, trùng thì đánh số, tên toàn ký hiệu vẫn có khoá", () => {
    assert.deepEqual(slotKeysFor(["Trưa 12h", "Tối 19h30", "Tối 19h30", "🏸"]), ["trua-12h", "toi-19h30", "toi-19h30-2", "cot-4"]);
  });
});

describe("ngày mở ra đầu tiên", () => {
  const dates = ["2026-10-23", "2026-10-24", "2026-10-25"];
  test("đang trong đợt thì là hôm nay", () => assert.equal(focusDay(dates, "2026-10-24"), "2026-10-24"));
  test("chưa tới đợt thì là ngày đầu", () => assert.equal(focusDay(dates, "2026-10-01"), "2026-10-23"));
  test("đã qua đợt thì là ngày cuối", () => assert.equal(focusDay(dates, "2026-12-01"), "2026-10-25"));
  test("sổ rỗng", () => assert.equal(focusDay([], "2026-10-24"), null));
});

describe("đổi ô", () => {
  const days: NotebookDay[] = [
    { date: "2026-10-23", label: "", cells: { trua: { text: "bắp bò", done: true }, toi: { text: "ức gà", done: false } } },
    { date: "2026-10-24", label: "", cells: { trua: { text: "tôm", done: false }, toi: { text: "cá ngừ", done: false } } },
  ];

  test("chữ và tick đi cùng nhau, ô khác giữ nguyên, không sửa mảng gốc", () => {
    const out = swapCells(days, { date: "2026-10-23", slot: "trua" }, { date: "2026-10-24", slot: "toi" });
    assert.deepEqual(out[0].cells.trua, { text: "cá ngừ", done: false });
    assert.deepEqual(out[1].cells.toi, { text: "bắp bò", done: true });
    assert.deepEqual(out[0].cells.toi, days[0].cells.toi);
    assert.equal(days[0].cells.trua.text, "bắp bò", "mảng gốc bị sửa");
  });

  test("cùng một ngày", () => {
    const out = swapCells(days, { date: "2026-10-23", slot: "trua" }, { date: "2026-10-23", slot: "toi" });
    assert.equal(out[0].cells.trua.text, "ức gà");
    assert.equal(out[0].cells.toi.text, "bắp bò");
  });

  test("chính nó hoặc ô không có thì không đổi gì", () => {
    assert.deepEqual(swapCells(days, { date: "2026-10-23", slot: "trua" }, { date: "2026-10-23", slot: "trua" }), days);
    assert.deepEqual(swapCells(days, { date: "2026-10-23", slot: "trua" }, { date: "2026-12-01", slot: "trua" }), days);
  });

  test("tiến độ ngày chỉ đếm ô có chữ", () => {
    assert.deepEqual(dayProgress({ date: "x", label: "", cells: { a: { text: "x", done: true }, b: { text: " ", done: true }, c: { text: "y", done: false } } }), { done: 1, total: 2 });
  });
});

describe("biểu đồ và số cân", () => {
  test("thang chứa mọi điểm, có khoảng thở", () => {
    const r = chartRange([61, 58, 59.7])!;
    assert.ok(r.min < 58 && r.max > 61);
  });

  test("một điểm hay toàn số bằng nhau vẫn có thang, không chia cho 0", () => {
    const r = chartRange([60])!;
    assert.ok(r.max > r.min);
    assert.equal(chartRange([]), null);
    assert.equal(chartRange([Number.NaN]), null);
  });

  test("nhập kiểu Việt: dấu phẩy, khoảng trắng; chữ và số vô lý là null", () => {
    assert.equal(parseReading("61,4"), 61.4);
    assert.equal(parseReading(" 60.8 "), 60.8);
    assert.equal(parseReading("60"), 60);
    for (const bad of ["", "abc", "-1", "0", "1e3", "61,4kg", "100000"]) assert.equal(parseReading(bad), null, bad);
  });

  /*
   * Chủ repo báo 26/10: nhập 2 chữ số thập phân mà app tự làm tròn. Bản cũ
   * hiển thị tối đa 1 chữ số nên "60,45" hiện thành "60,5" — và chính bài này
   * từng GHIM hành vi sai đó. Nay: nhập sao hiện vậy.
   */
  test("hiện đúng số đã nhập, KHÔNG làm tròn lên hay xuống", () => {
    for (const [typed, shown] of [
      ["60,45", "60,45"],
      ["60,44", "60,44"],
      ["60,05", "60,05"],
      ["59,999", "59,999"],
      ["61,4", "61,4"],
      ["61", "61"],
      ["60.15", "60,15"],
    ]) {
      const v = parseReading(typed);
      assert.notEqual(v, null, typed);
      assert.equal(formatReading(v!), shown, `${typed} phải hiện là ${shown}`);
    }
  });

  test("nhiều chữ số thập phân hơn mức hiện được thì không nhận, chứ không làm tròn lặng lẽ", () => {
    assert.equal(parseReading("60,4567"), null);
  });

  test("số lớn không bị chèn dấu chấm phân nghìn", () => {
    assert.equal(formatReading(12345), "12345");
  });

  test("hiệu giữa hai lần cân vẫn đúng tới phần trăm (không lộ sai số dấu phẩy động)", () => {
    assert.equal(formatReading(Math.abs(60.45 - 61)), "0,55");
  });
});
