import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { ETA_WINDOW_MS, liveEtaSeconds, observedKmh, trimSamples } from "@/lib/live-eta";

/*
 * Thoát khỏi vùng kẹt thì thời gian còn lại phải NGẮN LẠI.
 *
 * Đây là điều người dùng yêu cầu, và là điều một trung bình cộng dồn không bao
 * giờ làm được: nó nhớ mãi mười lăm phút đứng yên. Bài "ra khỏi kẹt" ở dưới là
 * bài duy nhất phân biệt được hai cách làm, nên nó là bài quan trọng nhất file.
 */

const T0 = 1_700_000_000_000;
/** Một chuỗi mẫu: đi `kmh` trong `minutes` phút, bắt đầu từ `remainingM`. */
function ride(from: number, kmh: number, minutes: number, startAt = T0) {
  const out = [{ at: startAt, remainingM: from }];
  const perMin = (kmh * 1000) / 60;
  for (let i = 1; i <= minutes; i++) {
    out.push({ at: startAt + i * 60_000, remainingM: Math.max(0, from - perMin * i) });
  }
  return out;
}

describe("chưa đủ bằng chứng thì dùng ước tính của tuyến", () => {
  const base = { remainingM: 10_000, routeTotalM: 20_000, routeTotalS: 3600 };
  test("không có mẫu nào", () => {
    assert.equal(liveEtaSeconds({ ...base, samples: [] }), 1800);
  });
  test("mới đi được vài chục mét", () => {
    const s = [{ at: T0, remainingM: 10_050 }, { at: T0 + 60_000, remainingM: 10_000 }];
    assert.equal(liveEtaSeconds({ ...base, samples: s }), 1800, "50 m chưa nói lên điều gì");
  });
  test("thời gian quá ngắn dù quãng đường đủ", () => {
    const s = [{ at: T0, remainingM: 10_500 }, { at: T0 + 10_000, remainingM: 10_000 }];
    assert.equal(observedKmh(s), null, "10 giây không đủ để kết luận");
  });
});

describe("đo tốc độ bằng quãng đường rút ngắn, không bằng đồng hồ tốc độ", () => {
  test("đi đều 20 km/h", () => {
    const kmh = observedKmh(ride(10_000, 20, 5));
    assert.ok(kmh !== null && Math.abs(kmh - 20) < 0.5, `nhận ${kmh}`);
  });

  test("đứng yên đèn đỏ giữa chừng vẫn ra tốc độ trung bình hợp lý", () => {
    /*
     * Đây là lý do không dùng `coords.speed`: dừng đèn đỏ là nó về 0, và thời
     * gian còn lại sẽ nhảy lên vô cực ngay giữa ngã tư.
     */
    const s = [
      { at: T0, remainingM: 10_000 },
      { at: T0 + 60_000, remainingM: 9_700 },   // đang chạy
      { at: T0 + 120_000, remainingM: 9_700 },  // đèn đỏ, đứng im
      { at: T0 + 180_000, remainingM: 9_400 },  // chạy tiếp
    ];
    const kmh = observedKmh(s);
    assert.ok(kmh !== null && kmh > 5 && kmh < 15, `nhận ${kmh}`);
  });

  test("lùi lại (vẽ lại đường / quay đầu) thì không tính", () => {
    const s = [{ at: T0, remainingM: 9_000 }, { at: T0 + 120_000, remainingM: 9_500 }];
    assert.equal(observedKmh(s), null);
  });

  test("số liệu vô lý bị loại", () => {
    // 120 km/h: nhảy vị trí, không phải đi.
    const s = [{ at: T0, remainingM: 10_000 }, { at: T0 + 60_000, remainingM: 8_000 }];
    assert.equal(observedKmh(s), null);
  });
});

describe("kẹt xe thì dài ra, thoát kẹt thì NGẮN LẠI", () => {
  const route = { routeTotalM: 20_000, routeTotalS: 3600 }; // tuyến hứa 20 km/h

  test("đang kẹt: thời gian còn lại dài hơn ước tính của tuyến", () => {
    const samples = ride(12_000, 6, 5);                 // 6 km/h suốt 5 phút
    const eta = liveEtaSeconds({ ...route, remainingM: 11_500, samples })!;
    const naive = Math.round(11_500 * (3600 / 20_000)); // cách tính cũ
    assert.ok(eta > naive, `kẹt mà vẫn báo ${eta}s, không hơn ${naive}s`);
  });

  test("RA KHỎI kẹt: cửa sổ trượt quên đoạn đứng yên và con số co lại", () => {
    /*
     * Mười lăm phút kẹt rồi năm phút chạy bon. Cửa sổ 5 phút chỉ còn thấy đoạn
     * chạy bon ⇒ ETA phải ngắn hơn hẳn so với lúc còn đang kẹt.
     *
     * Trung bình cộng dồn từ đầu chuyến sẽ trượt bài này: nó vẫn kéo theo cả
     * mười lăm phút đứng yên.
     */
    const stuck = ride(12_000, 6, 15);
    const afterStuck = stuck[stuck.length - 1];
    const freed = ride(afterStuck.remainingM, 28, 5, afterStuck.at);

    const etaWhileStuck = liveEtaSeconds({
      ...route, remainingM: afterStuck.remainingM,
      samples: trimSamples(stuck, afterStuck.at),
    })!;
    const last = freed[freed.length - 1];
    const etaAfter = liveEtaSeconds({
      ...route, remainingM: last.remainingM,
      samples: trimSamples([...stuck, ...freed], last.at),
    })!;

    // So theo giây-trên-mét, vì quãng còn lại đã khác nhau.
    const paceStuck = etaWhileStuck / afterStuck.remainingM;
    const paceAfter = etaAfter / last.remainingM;
    assert.ok(paceAfter < paceStuck * 0.8,
      `thoát kẹt rồi mà nhịp không co lại: ${paceStuck.toFixed(3)} → ${paceAfter.toFixed(3)} s/m`);
  });
});

describe("cửa sổ trượt", () => {
  test("bỏ mẫu quá cũ", () => {
    const s = [
      { at: T0, remainingM: 9_000 },
      { at: T0 + ETA_WINDOW_MS + 60_000, remainingM: 8_000 },
    ];
    const kept = trimSamples(s, T0 + ETA_WINDOW_MS + 60_000);
    assert.equal(kept.length, 1);
    assert.equal(kept[0].remainingM, 8_000);
  });

  test("không bao giờ trả về mảng rỗng khi vẫn còn dữ liệu", () => {
    const s = [{ at: T0, remainingM: 9_000 }];
    assert.equal(trimSamples(s, T0 + 10 * ETA_WINDOW_MS).length, 1);
  });
});
