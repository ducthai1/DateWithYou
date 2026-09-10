import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PARTNER_FIX_FRESH_MS,
  appleMapsDirectionsUrl,
  calculateDistance,
  calculateMidpoint,
  googleMapsDirectionsUrl,
  isOpenAt,
  isPartnerFixFresh,
  parseClockMinutes,
} from "@/lib/maps";

/*
 * The arithmetic behind "thấy nhau trên đường", "hẹn điểm giữa" and the
 * wheel's "đang mở cửa". Every one of these is wrong in a way nobody notices
 * until it matters: a midpoint in the sea, a place suggested at 3am, a partner
 * shown as live an hour after they closed the app.
 */

const SAIGON = { lat: 10.7769, lng: 106.7009 };
const HANOI = { lat: 21.0278, lng: 105.8342 };

test("calculateDistance: Sài Gòn tới Hà Nội khoảng 1.140 km", () => {
  const m = calculateDistance(SAIGON, HANOI);
  assert.ok(m > 1_130_000 && m < 1_180_000, `${m} m`);
  assert.equal(Number.isInteger(m), true, "trả về mét nguyên");
});

test("calculateDistance: cùng một điểm là 0, và đối xứng hai chiều", () => {
  assert.equal(calculateDistance(SAIGON, SAIGON), 0);
  assert.equal(calculateDistance(SAIGON, HANOI), calculateDistance(HANOI, SAIGON));
});

test("calculateDistance: hai điểm sát nhau vẫn đo được, không làm tròn về 0", () => {
  const near = { lat: SAIGON.lat + 0.001, lng: SAIGON.lng };
  const m = calculateDistance(SAIGON, near);
  assert.ok(m > 100 && m < 120, `${m} m — 0,001 độ vĩ khoảng 111 m`);
});

test("calculateMidpoint: nằm giữa, và cách đều hai đầu", () => {
  const mid = calculateMidpoint(SAIGON, HANOI);
  assert.ok(mid.lat > SAIGON.lat && mid.lat < HANOI.lat, `lat ${mid.lat}`);
  const a = calculateDistance(SAIGON, mid);
  const b = calculateDistance(HANOI, mid);
  assert.ok(Math.abs(a - b) < 1000, `lệch ${Math.abs(a - b)} m`);
});

test("calculateMidpoint: hai người ở cùng chỗ thì điểm giữa là chỗ đó", () => {
  const mid = calculateMidpoint(SAIGON, SAIGON);
  assert.ok(Math.abs(mid.lat - SAIGON.lat) < 1e-9, String(mid.lat));
  assert.ok(Math.abs(mid.lng - SAIGON.lng) < 1e-9, String(mid.lng));
});

test("parseClockMinutes: đọc HH:mm, trả null khi không đọc được", () => {
  assert.equal(parseClockMinutes("00:00"), 0);
  assert.equal(parseClockMinutes("07:30"), 450);
  assert.equal(parseClockMinutes("23:59"), 1439);
  for (const bad of [null, undefined, "", "không phải giờ", "ab:cd"]) {
    assert.equal(parseClockMinutes(bad), null, JSON.stringify(bad));
  }
});

test("isOpenAt: giờ thường trong ngày", () => {
  const place = { openTime: "08:00", closeTime: "22:00" };
  assert.equal(isOpenAt(place, new Date(2026, 8, 10, 12, 0)), true);
  assert.equal(isOpenAt(place, new Date(2026, 8, 10, 8, 0)), true, "đúng giờ mở là mở");
  assert.equal(isOpenAt(place, new Date(2026, 8, 10, 22, 0)), true, "đúng giờ đóng vẫn tính là mở");
  assert.equal(isOpenAt(place, new Date(2026, 8, 10, 7, 59)), false);
  assert.equal(isOpenAt(place, new Date(2026, 8, 10, 23, 0)), false);
});

test("isOpenAt: quán mở qua nửa đêm — chỗ dễ sai nhất", () => {
  const latenight = { openTime: "18:00", closeTime: "02:00" };
  assert.equal(isOpenAt(latenight, new Date(2026, 8, 10, 20, 0)), true, "tối");
  assert.equal(isOpenAt(latenight, new Date(2026, 8, 10, 1, 0)), true, "một giờ sáng vẫn mở");
  assert.equal(isOpenAt(latenight, new Date(2026, 8, 10, 3, 0)), false, "ba giờ sáng thì đóng");
  assert.equal(isOpenAt(latenight, new Date(2026, 8, 10, 12, 0)), false, "trưa thì đóng");
});

test("isOpenAt: không khai giờ thì coi như luôn mở, đừng loại khỏi vòng quay", () => {
  for (const place of [{}, { openTime: null, closeTime: null }, { openTime: "08:00" }]) {
    assert.equal(isOpenAt(place, new Date(2026, 8, 10, 3, 0)), true, JSON.stringify(place));
  }
});

test("isPartnerFixFresh: năm phút là mốc", () => {
  assert.equal(PARTNER_FIX_FRESH_MS, 5 * 60 * 1000);
  assert.equal(isPartnerFixFresh(new Date()), true);
  assert.equal(isPartnerFixFresh(Date.now() - 60_000), true, "một phút trước vẫn tươi");
  assert.equal(isPartnerFixFresh(Date.now() - 6 * 60_000), false, "sáu phút thì cũ");
  assert.equal(isPartnerFixFresh("không phải ngày"), false, "rác thì coi như cũ");
});

test("liên kết dẫn đường: đúng dạng của từng nhà bản đồ", () => {
  assert.equal(
    googleMapsDirectionsUrl(SAIGON),
    "https://www.google.com/maps/dir/?api=1&destination=10.7769,106.7009",
  );
  assert.equal(appleMapsDirectionsUrl(SAIGON), "https://maps.apple.com/?daddr=10.7769,106.7009");
});
