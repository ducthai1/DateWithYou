import assert from "node:assert/strict";
import test from "node:test";

import { findPlusCode, decodePlusCode, recoverPlusCode } from "@/lib/plus-code";
import { calculateDistance } from "@/lib/maps";

/*
 * Số thật, lấy từ một link người dùng đã lưu trên prod:
 *   .../maps/place/HX6G+8C4+Trạm+dừng+chân+Thiên+Thảo,+Ninh+Phước,+Khánh+Hòa/...
 * Ghim đã lưu nằm ở SAVED. Không có toạ độ nào khác trong URL đó.
 */
const SHORT = "HX6G+8C4";
const SEGMENT = "HX6G+8C4 Trạm dừng chân Thiên Thảo, Ninh Phước, Khánh Hòa";
const SAVED = { lat: 11.560670314965321, lng: 108.97622918909116 };

test("nhặt được plus code nằm lẫn trong tên chỗ", () => {
  assert.equal(findPlusCode(SEGMENT), SHORT);
  assert.equal(findPlusCode("Quán cà phê Góc Nhỏ, Quận 1"), null);
  // Dấu + trong tên không phải plus code.
  assert.equal(findPlusCode("Trà sữa 1+1, Tân Bình"), null);
});

test("mã đầy đủ giải ra đúng chỗ, không cần tham chiếu", () => {
  const p = decodePlusCode("7P3CHX6G+8C4");
  assert.ok(p);
  assert.ok(calculateDistance(p, SAVED) < 100, `lệch ${calculateDistance(p, SAVED)}m`);
});

test("mã ngắn + tham chiếu gần → đúng chỗ", () => {
  // Tham chiếu cỡ một ứng viên mà bộ tìm kiếm trả về (đo thật: lệch 48m).
  const p = recoverPlusCode(SHORT, { lat: 11.56051, lng: 108.97664 });
  assert.ok(p);
  assert.ok(calculateDistance(p, SAVED) < 100, `lệch ${calculateDistance(p, SAVED)}m`);
});

test("mã ngắn chỉ đúng trong ô 1° — tham chiếu xa thì trượt ô", () => {
  /*
   * Đây là LÝ DO tầng gọi phải kiểm lại kết quả, chứ không phải lỗi cần sửa ở
   * đây: lược 4 ký tự đầu thì mã chỉ phân biệt được trong phạm vi ±0.5°. Lấy
   * Nha Trang (76km, đúng cái mà bộ geocode theo tên trả về) làm tham chiếu là
   * ra một điểm sai hẳn một ô — và nó cách chính tham chiếu đó hàng chục km,
   * nên bên gọi phát hiện được.
   */
  const ref = { lat: 12.202537, lng: 109.216983 };
  const p = recoverPlusCode(SHORT, ref);
  assert.ok(p);
  assert.ok(calculateDistance(p, SAVED) > 50_000);
  assert.ok(calculateDistance(p, ref) > 40_000, "phải lệch xa tham chiếu để bên gọi loại được");
});

test("chọn ô gần nhất, không phải ô chứa tham chiếu", () => {
  // Tham chiếu nằm ngay dưới ranh ô: đáp án đúng là ô phía trên nó.
  const p = recoverPlusCode(SHORT, { lat: 11.99, lng: 108.99 });
  assert.ok(p);
  assert.ok(calculateDistance(p, SAVED) < 100, `lệch ${calculateDistance(p, SAVED)}m`);
});

test("rác thì trả null, không đoán", () => {
  assert.equal(decodePlusCode("HX6G+8C4"), null, "mã ngắn không tự giải được");
  assert.equal(recoverPlusCode("XX+YY", SAVED), null, "ký tự ngoài bảng mã");
  assert.equal(recoverPlusCode("", SAVED), null);
});
