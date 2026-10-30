import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { cumulativeMetres } from "@/lib/route-geometry";
import { partnerProgress } from "@/features/locations/use-partner-progress";

/*
 * Đi cùng nhau: cột của người kia từng đứng yên ở con số lúc xuất phát suốt
 * chuyến, và dòng "đến trễ hơn X phút" so số đang chạy bên này với số đóng băng
 * bên kia. Ở đây chốt thứ tự nguồn: máy họ tự đo → bên này tự ước → số lúc đi.
 */

/** Đường thẳng ~1,1 km theo kinh tuyến, 40 điểm. */
const coords: Array<[number, number]> = Array.from({ length: 40 }, (_, i) => [106.7, 10.77 + (0.01 * i) / 39]);
const cum = cumulativeMetres(coords);
const totalM = cum.at(-1)!;
const totalS = 300;

describe("thời gian còn lại của người kia", () => {
  test("máy họ tự đo thì dùng đúng số đó", () => {
    const p = partnerProgress({ lat: 10.77, lng: 106.7, remainingMeters: 800, remainingSeconds: 222 }, coords, cum, totalM, totalS);
    assert.deepEqual(p, { meters: 800, seconds: 222 });
  });

  test("máy họ không gửi (bản cũ, chưa dẫn đường): ước theo vị trí của họ trên tuyến, và đếm lùi khi họ đi", () => {
    const atStart = partnerProgress({ lat: 10.77, lng: 106.7, remainingMeters: null, remainingSeconds: null }, coords, cum, totalM, totalS);
    const halfway = partnerProgress({ lat: 10.775, lng: 106.7 }, coords, cum, totalM, totalS);
    assert.ok(Math.abs(atStart.meters! - totalM) < 5);
    assert.ok(Math.abs(halfway.meters! - totalM / 2) < 15, `nửa đường mà còn ${halfway.meters} m`);
    assert.ok(Math.abs(halfway.seconds! - totalS / 2) < 5, `nửa đường mà còn ${halfway.seconds} s`);
  });

  test("chưa có tuyến của họ: đành dùng số lúc xuất phát", () => {
    const p = partnerProgress({ lat: 10.775, lng: 106.7 }, null, null, 5000, 900);
    assert.deepEqual(p, { meters: 5000, seconds: 900 });
  });

  test("chưa thấy họ đâu: không bịa vị trí", () => {
    assert.deepEqual(partnerProgress(null, coords, cum, totalM, totalS), { meters: totalM, seconds: totalS });
  });
});
