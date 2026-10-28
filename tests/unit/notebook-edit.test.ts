import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  applyRange,
  applySlots,
  cellsForSlots,
  copyDayTo,
  filledSlots,
  sameWeekdayAfter,
  swapDayContents,
  weeksOf,
  type StoredDay,
} from "@/lib/notebook-edit";

/*
 * Chủ repo 28/10: sổ "gò bó" — tạo xong là không đổi được khoảng ngày, không
 * thêm/bớt cột, không chép được ngày. Đây là phần thuần của các thao tác đó.
 */

const day = (date: string, texts: Record<string, string> = {}, label = ""): StoredDay => ({
  date,
  label,
  cells: ["trua", "toi"].map((slot) => ({ slot, text: texts[slot] ?? "", done: !!texts[slot] && slot === "trua" })),
});

describe("đổi khoảng ngày", () => {
  const days = [day("2026-10-23", { trua: "bò" }), day("2026-10-24"), day("2026-10-25", {}, "nghỉ")];
  test("kéo dài: ngày cũ giữ nguyên, ngày mới thêm vào rỗng", () => {
    const r = applyRange(days, ["trua", "toi"], "2026-10-23", "2026-10-27")!;
    assert.equal(r.days.length, 5);
    assert.equal(r.added, 2);
    assert.deepEqual(r.days[0], days[0]);
    assert.deepEqual(r.days[4].cells.map((c) => c.text), ["", ""]);
    assert.deepEqual(r.lost, []);
  });
  test("rút ngắn: báo đúng NGÀY CÓ NỘI DUNG sẽ mất (nhãn cũng là nội dung), ngày trống thì không", () => {
    const r = applyRange(days, ["trua", "toi"], "2026-10-24", "2026-10-24")!;
    assert.deepEqual(r.days.map((d) => d.date), ["2026-10-24"]);
    assert.deepEqual(r.lost, ["2026-10-23", "2026-10-25"]);
  });
  test("khoảng ngược hoặc quá dài: không làm", () => {
    assert.equal(applyRange(days, ["trua"], "2026-10-25", "2026-10-23"), null);
    assert.equal(applyRange(days, ["trua"], "2026-01-01", "2026-12-31"), null);
  });
});

describe("cột", () => {
  const current = [{ key: "trua", label: "Trưa" }, { key: "toi", label: "Tối" }];
  test("đổi tên + sắp lại + thêm: cột cũ giữ khoá (ô đi theo), cột mới có khoá không trùng", () => {
    const r = applySlots(current, [{ key: "toi", label: "Tối 19h" }, { label: "Trưa" }, { key: "trua", label: "Trưa 12h" }]);
    assert.deepEqual(r.slots.map((s) => s.key), ["toi", "trua-2", "trua"]);
    assert.deepEqual(r.slots.map((s) => s.label), ["Tối 19h", "Trưa", "Trưa 12h"]);
    assert.deepEqual(r.removed, []);
  });
  test("xoá cột: báo khoá bị bỏ; khoá lạ gửi lên coi như cột mới", () => {
    const r = applySlots(current, [{ key: "trua", label: "Trưa" }, { key: "bia-dat", label: "Nước" }]);
    assert.deepEqual(r.removed, ["toi"]);
    assert.equal(r.slots[1].key, "nuoc");
  });
  test("các ngày được xếp lại theo cột: cột mới rỗng, cột bỏ biến mất, ô cũ còn nguyên", () => {
    const days = [day("2026-10-23", { trua: "bò", toi: "cá" })];
    const [d] = cellsForSlots(days, [{ key: "toi", label: "Tối" }, { key: "nuoc", label: "Nước" }]);
    assert.deepEqual(d.cells, [{ slot: "toi", text: "cá", done: false }, { slot: "nuoc", text: "", done: false }]);
  });
  test("cột nào đã có chữ", () => {
    assert.deepEqual([...filledSlots([day("2026-10-23", { toi: "cá" })])], ["toi"]);
  });
});

describe("chép và đổi ngày", () => {
  const days = [day("2026-10-26", { trua: "gà", toi: "cá" }, "tập A"), day("2026-10-27"), day("2026-11-02", { trua: "x" })];
  test("chép sang ngày khác: nhãn + chữ, BỎ tick; nguồn và ngày ngoài sổ không đổi", () => {
    const r = copyDayTo(days, "2026-10-26", ["2026-11-02", "2026-10-26", "2030-01-01"]);
    assert.equal(r[2].label, "tập A");
    assert.deepEqual(r[2].cells, [{ slot: "trua", text: "gà", done: false }, { slot: "toi", text: "cá", done: false }]);
    assert.deepEqual(r[0], days[0]);
    assert.equal(r.length, 3);
  });
  test("đổi hai ngày: đổi cả nhãn, chữ và tick, ngày vẫn ở chỗ cũ", () => {
    const r = swapDayContents(days, "2026-10-26", "2026-10-27");
    assert.equal(r[0].date, "2026-10-26");
    assert.equal(r[0].label, "");
    assert.equal(r[1].label, "tập A");
    assert.equal(r[1].cells[0].done, true);
  });
  test("cùng thứ các tuần sau", () => {
    const dates = ["2026-10-26", "2026-10-27", "2026-11-02", "2026-11-09", "2026-11-10"];
    assert.deepEqual(sameWeekdayAfter(dates, "2026-10-26"), ["2026-11-02", "2026-11-09"]);
  });
});

describe("chia tuần", () => {
  test("thứ 2 → chủ nhật; tuần đầu và cuối có thể thiếu", () => {
    // 23/10/2026 là thứ 6; 6/12/2026 là chủ nhật.
    const dates = ["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-11-01", "2026-11-02"];
    const w = weeksOf(dates);
    assert.deepEqual(w.map((x) => [x.index, x.start, x.end, x.dates.length]), [
      [1, "2026-10-19", "2026-10-25", 3],
      [2, "2026-10-26", "2026-11-01", 2],
      [3, "2026-11-02", "2026-11-08", 1],
    ]);
  });
});
