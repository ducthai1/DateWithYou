import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  compassFromEvent, deltaDeg, normaliseDeg, pickHeading, screenRotation, smoothHeading,
} from "@/lib/heading";

/*
 * Toán góc, chỗ nào cũng có thể sai một cách im lặng.
 *
 * Ba cái bẫy được chốt ở đây: vòng qua hướng bắc (359° và 1° cách nhau 2°),
 * `alpha` của W3C quay NGƯỢC chiều so với `webkitCompassHeading` của iOS, và
 * bản đồ tự xoay nên góc tuyệt đối bị cộng hai lần. Sai bất kỳ cái nào thì cái
 * phễu vẫn hiện ra trông rất hợp lý — và chỉ đúng ở đúng một hướng.
 */

describe("vòng qua hướng bắc", () => {
  test("normaliseDeg đưa mọi góc về [0,360)", () => {
    assert.equal(normaliseDeg(0), 0);
    assert.equal(normaliseDeg(360), 0);
    assert.equal(normaliseDeg(-90), 270);
    assert.equal(normaliseDeg(725), 5);
  });

  test("deltaDeg lấy đường ngắn nhất, không lấy hiệu số thô", () => {
    assert.equal(deltaDeg(359, 1), 2, "qua bắc phải là 2°, không phải -358°");
    assert.equal(deltaDeg(1, 359), -2);
    assert.equal(deltaDeg(10, 10), 0);
    assert.equal(Math.abs(deltaDeg(0, 180)), 180);
  });

  test("làm mượt không quay ngược nguyên vòng khi đi qua bắc", () => {
    // 358° → 2°: phải nhích LÊN qua 0, không phải chạy ngược xuống 300.
    const out = smoothHeading(358, 2, 0.5);
    assert.ok(out > 358 || out < 2, `nhận ${out} — đã quay vòng sai chiều`);
    assert.ok(Math.abs(deltaDeg(358, out)) <= 2);
  });

  test("lần đầu thì nhận thẳng, không mượt từ số 0", () => {
    assert.equal(smoothHeading(null, 123), 123);
  });
});

describe("chọn giữa GPS và la bàn", () => {
  /*
   * Đảo so với bản đầu: trước đây đang chạy thì tin GPS, để tránh nhiễu từ
   * trường quanh xe. Cái giá là phễu chỉ nhích mỗi lần có định vị mới (~1
   * giây/nhịp) và không hề nhúc nhích khi người ta xoay người — chủ xe báo
   * đúng như vậy. Hướng ĐANG ĐI đã có cái mũi tên nói rồi.
   */
  test("đang chạy vẫn tin la bàn — phễu là hướng NHÌN, không phải hướng đi", () => {
    const h = pickHeading({ gpsHeading: 90, compassHeading: 200 });
    assert.deepEqual(h, { deg: 200, source: "compass" });
  });

  test("đứng yên thì tin la bàn — đây là cả lý do làm tính năng này", () => {
    // Dừng ở ngã tư, xoay người tìm đường: GPS không nói gì, la bàn nói được.
    const h = pickHeading({ gpsHeading: null, compassHeading: 200 });
    assert.deepEqual(h, { deg: 200, source: "compass" });
  });

  test("không có la bàn thì dùng GPS — máy cũ, hoặc iOS chưa cho phép", () => {
    const h = pickHeading({ gpsHeading: 90, compassHeading: null });
    assert.deepEqual(h, { deg: 90, source: "gps" });
  });

  test("không có gì thì trả null, không bịa hướng bắc", () => {
    assert.equal(pickHeading({ gpsHeading: null, compassHeading: null }), null);
  });
});

describe("xoay trên màn hình phải trừ đi góc xoay của bản đồ", () => {
  test("bản đồ hướng bắc: giữ nguyên", () => {
    assert.equal(screenRotation(90, 0), 90);
  });

  test("bản đồ đang bám theo hướng đi: phễu chỉ thẳng lên", () => {
    // Đây là trường hợp mà `rotation={0}` của bản cũ vô tình đúng.
    assert.equal(screenRotation(90, 90), 0);
  });

  test("nhìn ngang so với hướng đang chạy", () => {
    assert.equal(screenRotation(90, 180), 270);
  });

  test("thiếu góc bản đồ thì coi như hướng bắc, không vỡ", () => {
    assert.equal(screenRotation(45, null), 45);
    assert.equal(screenRotation(45, undefined), 45);
  });
});

describe("đọc la bàn từ sự kiện của trình duyệt", () => {
  test("iOS: webkitCompassHeading đã là góc so với bắc thật", () => {
    assert.equal(compassFromEvent({ webkitCompassHeading: 123, alpha: 50 }), 123);
  });

  test("W3C: alpha quay NGƯỢC chiều nên phải lấy 360 trừ đi", () => {
    // Quên chỗ này thì phễu chỉ đúng ở bắc và nam, sai gương ở mọi hướng khác.
    assert.equal(compassFromEvent({ alpha: 90, absolute: true }), 270);
    assert.equal(compassFromEvent({ alpha: 0, absolute: true }), 0);
  });

  test("alpha tương đối (absolute=false) thì không dùng — nó không phải hướng bắc", () => {
    assert.equal(compassFromEvent({ alpha: 90, absolute: false }), null);
  });

  test("không có gì thì null", () => {
    assert.equal(compassFromEvent({}), null);
    assert.equal(compassFromEvent({ alpha: null }), null);
  });
});
