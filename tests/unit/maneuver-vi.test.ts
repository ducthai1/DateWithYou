import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtMetresVi, isRealTurn, maneuverStreet, maneuverVerb } from "@/lib/maneuver-vi";

/*
 * What the voice says while someone is riding a motorbike. It is read aloud,
 * so the numbers have to be sayable: nobody says "một phẩy không ki lô mét",
 * and "1000 mét" next to "1 ki lô mét" in consecutive breaths sounds broken.
 */

test("fmtMetresVi: dưới 100 mét làm tròn về chục, không bao giờ dưới 10", () => {
  assert.equal(fmtMetresVi(0), "10 mét");
  assert.equal(fmtMetresVi(4), "10 mét");
  assert.equal(fmtMetresVi(46), "50 mét");
  assert.equal(fmtMetresVi(94), "90 mét");
});

test("fmtMetresVi: từ 100 mét làm tròn về bội số 50", () => {
  assert.equal(fmtMetresVi(120), "100 mét");
  assert.equal(fmtMetresVi(130), "150 mét");
  assert.equal(fmtMetresVi(480), "500 mét");
});

test("fmtMetresVi: đổi sang ki lô mét từ 975 mét, tránh đọc '1000 mét'", () => {
  assert.equal(fmtMetresVi(974), "950 mét");
  assert.equal(fmtMetresVi(975), "1 ki lô mét", "không đọc là '1,0 ki lô mét'");
  assert.equal(fmtMetresVi(1500), "1,5 ki lô mét", "dùng dấu phẩy thập phân kiểu Việt");
  assert.equal(fmtMetresVi(2000), "2 ki lô mét");
});

test("fmtMetresVi: từ 10 km trở lên thì bỏ phần lẻ", () => {
  assert.equal(fmtMetresVi(10_000), "10 ki lô mét");
  assert.equal(fmtMetresVi(12_400), "12 ki lô mét");
});

test("fmtMetresVi: luôn ra chuỗi đọc được, không có NaN hay dấu chấm", () => {
  for (const m of [0, 7, 99, 100, 974, 975, 1049, 9999, 10_001, 100_000]) {
    const s = fmtMetresVi(m);
    assert.doesNotMatch(s, /NaN|undefined|\./, `${m} → ${s}`);
    assert.match(s, /(mét|ki lô mét)$/, `${m} → ${s}`);
  }
});

test("maneuverVerb: mã lạ vẫn có câu để đọc", () => {
  assert.equal(typeof maneuverVerb(1), "string");
  assert.equal(maneuverVerb(9999), "đi tiếp");
});

test("isRealTurn: điểm đến không phải một cú rẽ", () => {
  assert.equal(isRealTurn(9999), false, "mã không biết thì không hô rẽ");
  const types = Array.from({ length: 40 }, (_, i) => i);
  assert.ok(types.some((t) => isRealTurn(t)), "phải có ít nhất vài mã là rẽ thật");
});

test("maneuverStreet: mấy loại không có tên đường thì trả null", () => {
  const base = { streetNames: ["Nguyễn Huệ"] } as never;
  for (const type of [12, 13, 26]) {
    assert.equal(maneuverStreet({ ...(base as object), type } as never), null, String(type));
  }
  assert.equal(maneuverStreet({ ...(base as object), type: 1 } as never), "Nguyễn Huệ");
  assert.equal(maneuverStreet({ streetNames: ["", "  Lê Lợi  "], type: 1 } as never), "Lê Lợi");
  assert.equal(maneuverStreet({ streetNames: [], type: 1 } as never), null);
});
