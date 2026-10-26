import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { presenceDelivery } from "@/lib/listen-delivery";

/*
 * Chủ repo 26/10: người kia chuyển tab / sang app khác thì máy mình phải biết.
 * Stream chỉ được nói MỘT lần cho mỗi thay đổi — và nói ngay với một kết nối
 * vừa mở, để trang vừa tải lại không phải chờ người kia đổi tiếp mới biết.
 */
const at = new Date("2026-10-26T06:00:00Z");

describe("báo người kia rời / quay lại màn hình xem", () => {
  test("kết nối mới: nói luôn điều đang ghi", () => {
    const r = presenceDelivery(null, { away: true, kind: "hidden", at });
    assert.deepEqual(r.send, { away: true, kind: "hidden" });
  });
  test("cùng một bản ghi thì không nói lại", () => {
    const first = presenceDelivery(null, { away: true, kind: "blur", at });
    assert.equal(presenceDelivery(first.key, { away: true, kind: "blur", at }).send, null);
  });
  test("quay lại là một thay đổi", () => {
    const first = presenceDelivery(null, { away: true, kind: "hidden", at });
    const back = presenceDelivery(first.key, { away: false, kind: null, at: new Date(at.getTime() + 5000) });
    assert.deepEqual(back.send, { away: false, kind: null });
  });
  test("rời lần hai (cùng kiểu, giờ khác) vẫn là tin mới", () => {
    const first = presenceDelivery(null, { away: true, kind: "hidden", at });
    const again = presenceDelivery(first.key, { away: true, kind: "hidden", at: new Date(at.getTime() + 60000) });
    assert.deepEqual(again.send, { away: true, kind: "hidden" });
  });
  test("chưa ai ghi gì, hoặc bản ghi hỏng: im", () => {
    assert.equal(presenceDelivery(null, undefined).send, null);
    assert.equal(presenceDelivery(null, { kind: "hidden" }).send, null);
  });
  test("kiểu lạ đọc là rời hẳn (hidden), không ném", () => {
    assert.deepEqual(presenceDelivery(null, { away: true, kind: "weird", at }).send, { away: true, kind: "hidden" });
  });
});
