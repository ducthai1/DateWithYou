import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  PROVIDER_MIN_TOP_SPEED,
  PROVIDER_MAX_TOP_SPEED,
  averageRideKmh,
  minutesOfDayIn,
  topSpeedFor,
  trafficBand,
} from "@/lib/ride-speed";

/*
 * Bắt nhà cung cấp trả về thời gian THẬT thay vì thời gian đường thoáng.
 *
 * Bài quan trọng nhất trong file này là bài về ngưỡng 20. Đo ngày 17/09/2026
 * trên chính Stadia: gửi top_speed 16/17/18/19 thì nó **im lặng bỏ qua** và
 * trả về đúng con số nhanh nhất (38 km/h), 20 mới bắt đầu có tác dụng. Tức là
 * xin đi chậm hơn lại nhận về đáp án nhanh hơn, và không có gì trong phản hồi
 * nói cho biết điều đó. Một hằng số tụt xuống 18 là ETA sai gấp đôi, im ru.
 */

describe("không bao giờ gửi giá trị bị nhà cung cấp bỏ qua", () => {
  test("mọi khung giờ đều cho cap >= ngưỡng có tác dụng", () => {
    for (let m = 0; m < 1440; m += 5) {
      const cap = topSpeedFor(m);
      assert.ok(cap >= PROVIDER_MIN_TOP_SPEED, `phút ${m} cho cap ${cap} — sẽ bị bỏ qua`);
      assert.ok(cap <= PROVIDER_MAX_TOP_SPEED, `phút ${m} cho cap ${cap} — vượt trần`);
      assert.ok(Number.isInteger(cap), `cap phải là số nguyên, nhận ${cap}`);
    }
  });

  test("dù người dùng đo được tốc độ rất chậm cũng không tụt xuống dưới ngưỡng", () => {
    // Một cặp toàn đi kẹt xe, trung bình 6 km/h: 6*1.2*0.9 = 6.5 → phải bị kẹp lên 20.
    assert.equal(topSpeedFor(17 * 60, 6), PROVIDER_MIN_TOP_SPEED);
  });

  test("và tốc độ đo được cao bất thường cũng không vượt trần", () => {
    assert.equal(topSpeedFor(3 * 60, 200), PROVIDER_MAX_TOP_SPEED);
  });
});

describe("khung giờ", () => {
  test("hai đợt cao điểm của Sài Gòn", () => {
    assert.equal(trafficBand(7 * 60), "rush");
    assert.equal(trafficBand(17 * 60 + 34), "rush", "17:34 — đúng lúc người dùng báo sai");
    assert.equal(trafficBand(19 * 60 + 29), "rush");
  });

  test("ngoài giờ cao điểm là ban ngày", () => {
    assert.equal(trafficBand(10 * 60), "day");
    assert.equal(trafficBand(19 * 60 + 30), "day", "vừa hết cao điểm");
    assert.equal(trafficBand(21 * 60 + 59), "day");
  });

  test("đêm", () => {
    assert.equal(trafficBand(22 * 60), "night");
    assert.equal(trafficBand(2 * 60), "night");
    assert.equal(trafficBand(4 * 60 + 59), "night");
    assert.equal(trafficBand(5 * 60), "day", "5 giờ sáng là hết đêm");
  });

  test("giá trị quanh vòng ngày không làm hỏng phân loại", () => {
    assert.equal(trafficBand(1440), trafficBand(0));
    assert.equal(trafficBand(-60), trafficBand(23 * 60));
  });

  test("cao điểm phải CHẬM hơn ban ngày, ban ngày chậm hơn đêm", () => {
    // Thứ tự này mới là điều cần đúng; con số cụ thể có thể chỉnh sau.
    assert.ok(topSpeedFor(17 * 60) < topSpeedFor(12 * 60));
    assert.ok(topSpeedFor(12 * 60) < topSpeedFor(2 * 60));
  });
});

describe("học từ chuyến đi thật của chính hai người", () => {
  test("cộng tổng quãng đường và tổng thời gian, không lấy trung bình của từng chuyến", () => {
    /*
     * Một cú nhích 900 m mất 9 phút (6 km/h, đang tìm chỗ gửi xe) đi cùng một
     * chuyến 20 km trong 60 phút. Trung bình cộng của hai tốc độ là 13 km/h;
     * tổng-trên-tổng ra ~18,2 — và 18,2 mới là tốc độ họ thực sự đi.
     */
    const kmh = averageRideKmh([
      { distanceMeters: 900, durationSeconds: 540 },
      { distanceMeters: 20000, durationSeconds: 3600 },
    ]);
    assert.ok(kmh !== null);
    assert.ok(kmh > 17 && kmh < 19, `nhận ${kmh?.toFixed(1)} km/h`);
  });

  test("bỏ chuyến quá ngắn và chuyến có số liệu vô lý", () => {
    assert.equal(averageRideKmh([{ distanceMeters: 300, durationSeconds: 120 }]), null);
    // 120 km/h trên xe máy trong phố là lỗi ghi nhận, không phải dữ liệu.
    assert.equal(averageRideKmh([{ distanceMeters: 20000, durationSeconds: 600 }]), null);
    // Đồng hồ chạy suốt bữa trưa: 2 km trong 2 tiếng.
    assert.equal(averageRideKmh([{ distanceMeters: 2000, durationSeconds: 7200 }]), null);
  });

  test("chưa đủ quãng đường thì chưa tin, để bảng giờ quyết", () => {
    assert.equal(averageRideKmh([{ distanceMeters: 1000, durationSeconds: 200 }]), null);
  });

  test("có số đo thật thì nó thắng bảng giờ", () => {
    const slow = topSpeedFor(12 * 60, 12);   // cặp đi chậm
    const fast = topSpeedFor(12 * 60, 30);   // cặp đi nhanh
    assert.ok(slow < fast, `${slow} phải nhỏ hơn ${fast}`);
  });
});

describe("đổi giờ UTC sang giờ địa phương", () => {
  test("17:34 giờ Sài Gòn là cao điểm, dù UTC là 10:34", () => {
    const d = new Date("2026-09-17T10:34:00Z");
    assert.equal(trafficBand(minutesOfDayIn(d, 7)), "rush");
    // Cùng khoảnh khắc đó, đọc theo UTC thì lại thành "ban ngày" — đây chính là
    // cách một lỗi múi giờ làm ETA sai mà không ai thấy.
    assert.equal(trafficBand(minutesOfDayIn(d, 0)), "day");
  });
});
