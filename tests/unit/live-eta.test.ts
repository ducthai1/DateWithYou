import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  ETA_WINDOW_MS,
  newEtaTracker,
  onNewRoute,
  stepEta,
  tripFactor,
  trimSamples,
  type EtaTracker,
} from "@/lib/live-eta";

/*
 * Hai yêu cầu của người dùng, cái sau không được phá cái trước:
 *
 *   1. Thoát khỏi vùng kẹt thì thời gian còn lại phải NGẮN LẠI — một trung bình
 *      cộng dồn nhớ mãi mười lăm phút đứng yên thì không làm được.
 *   2. Một đoạn đường thoáng không được kéo con số tụt rồi vọt (29/10/2026, qua
 *      cầu Sài Gòn: Google 51 phút, app 32, rồi 56) — cửa sổ năm phút nhân cho
 *      cả quãng còn lại thì không làm được.
 *
 * Mỗi chuyến ở đây được "chạy" như GPS thật: một lần định vị mỗi hai giây.
 */

const T0 = 1_700_000_000_000;
/** Tuyến hứa 18,5 km/h — tầm khung giờ ban ngày của ride-speed.ts. */
const PLAN_KMH = 18.5;
const secPerM = 3.6 / PLAN_KMH;

type Ride = { t: EtaTracker; at: number; rem: number; eta: number | null; shown: number[] };

function begin(remainingM: number): Ride {
  return { t: newEtaTracker(), at: T0, rem: remainingM, eta: null, shown: [] };
}

/** Chạy `kmh` trong `minutes` phút; ghi lại số phút hiển thị mỗi phút. */
function drive(r: Ride, kmh: number, minutes: number, deviationM = 5): Ride {
  let { t, at, rem, eta } = r;
  const shown = [...r.shown];
  for (let i = 0; i < minutes * 30; i++) {
    const s = stepEta(t, { at, remainingM: rem, deviationM, secPerM });
    t = s.tracker;
    eta = s.seconds;
    if ((at - T0) % 60_000 === 0 && eta != null) shown.push(Math.round(eta / 60));
    at += 2000;
    rem = Math.max(0, rem - (kmh / 3.6) * 2);
  }
  return { t, at, rem, eta, shown };
}

const planMin = (m: number) => (m * secPerM) / 60;

describe("chưa có gì để học thì theo tuyến", () => {
  test("lần định vị đầu tiên ra đúng ước tính của tuyến", () => {
    const s = stepEta(newEtaTracker(), { at: T0, remainingM: 10_000, deviationM: 0, secPerM });
    assert.equal(s.seconds, Math.round(10_000 * secPerM));
  });

  test("mở dẫn đường rồi đứng chờ ba phút: chưa phải là chạy chậm", () => {
    const r = drive(begin(10_000), 0, 3);
    assert.equal(r.t.departed, false);
    assert.equal(r.t.elapsedS, 0, "thời gian chờ ở chỗ xuất phát bị tính vào nhịp chạy");
    assert.ok(Math.abs(r.eta! / 60 - planMin(10_000)) < 0.5, `chờ mà con số đổi: ${r.eta! / 60} phút`);
  });

  test("tuyến không có thời gian thì không bịa", () => {
    const s = stepEta(newEtaTracker(), { at: T0, remainingM: 10_000, deviationM: 0, secPerM: 0 });
    assert.equal(s.seconds, null);
  });
});

describe("qua cầu Sài Gòn: đoạn thoáng không kéo tụt, đoạn kẹt không làm vọt", () => {
  /*
   * Chờ 2 phút, 8 phút đường thoáng 30 km/h, 10 phút kẹt chân cầu 9 km/h, rồi
   * phố bình thường. Bản cũ: phút 10 báo 32 (thật 54), phút 16 báo 75 (thật 48).
   */
  const open = drive(drive(begin(20_000), 0, 2), 30, 8);
  const jammed = drive(open, 9, 10);
  const rest = drive(jammed, 19, 40);

  test("sau đoạn thoáng, không hứa cả quãng còn lại cũng thoáng như thế", () => {
    const naive = open.rem / (30 / 3.6) / 60; // kiểu cũ: tốc độ năm phút × cả quãng
    const plan = planMin(open.rem);
    const eta = open.eta! / 60;
    assert.ok(eta > naive + 10, `vẫn ngoại suy: ${eta.toFixed(0)} phút, kiểu cũ ${naive.toFixed(0)}`);
    assert.ok(eta >= plan * 0.85, `tụt quá xa ước tính tuyến: ${eta.toFixed(0)} so với ${plan.toFixed(0)}`);
  });

  test("vào đoạn kẹt, con số tăng chứ không vọt", () => {
    const peak = Math.max(...jammed.shown.slice(open.shown.length));
    assert.ok(peak - open.shown.at(-1)! <= 8, `vọt từ ${open.shown.at(-1)} lên ${peak}`);
  });

  test("cả chuyến không có phút nào nhảy quá 3 phút so với phút trước", () => {
    const jumps = rest.shown.slice(1).map((m, i) => m - rest.shown[i] + 1); // +1: một phút đã trôi
    const worst = Math.max(...jumps.map(Math.abs));
    assert.ok(worst <= 3, `nhảy ${worst} phút trong một phút · ${rest.shown.join(" ")}`);
  });
});

describe("kẹt xe thì dài ra, thoát kẹt thì NGẮN LẠI", () => {
  test("đang kẹt: dài hơn ước tính của tuyến", () => {
    const r = drive(drive(begin(12_000), 20, 1), 6, 5);
    assert.ok(r.eta! / 60 > planMin(r.rem), `kẹt mà vẫn báo ${r.eta! / 60} phút`);
  });

  test("RA KHỎI kẹt năm phút: nhịp mỗi mét co lại hơn 20%", () => {
    /*
     * Mười lăm phút kẹt rồi năm phút chạy bon. So theo giây-trên-mét vì quãng
     * còn lại đã khác nhau. Hệ số cả chuyến không quên thì chỉ co 18% — chính
     * là "nhớ mãi mười lăm phút đứng yên" mà người dùng không muốn.
     */
    const stuck = drive(drive(begin(15_000), 20, 1), 6, 15);
    const freed = drive(stuck, 28, 5);
    const ratio = freed.eta! / freed.rem / (stuck.eta! / stuck.rem);
    assert.ok(ratio < 0.8, `thoát kẹt rồi mà nhịp chỉ còn ${(ratio * 100).toFixed(0)}%`);
  });
});

describe("những gì làm hỏng phép đo", () => {
  test("vẽ lại đường: quên cửa sổ, giữ hệ số đã học", () => {
    const r = drive(drive(begin(15_000), 20, 1), 8, 10);
    const f = tripFactor(r.t);
    const next = onNewRoute(r.t);
    assert.equal(next.samples.length, 0);
    assert.equal(tripFactor(next), f);
    assert.ok(f > 1.05, `mười phút 8 km/h mà chưa học được gì: ${f.toFixed(2)}`);
  });

  test("vị trí khớp nhảy 2 km trong 2 giây không thành 'tốc độ'", () => {
    const r = drive(drive(begin(15_000), 20, 1), 20, 5);
    const before = r.eta!;
    const s = stepEta(r.t, { at: r.at, remainingM: r.rem - 2000, deviationM: 5, secPerM });
    assert.equal(s.tracker.samples.length, 1, "cú nhảy phải mở lại cửa sổ");
    assert.equal(s.tracker.elapsedS, r.t.elapsedS);
    assert.equal(s.tracker.plannedS, r.t.plannedS);
    assert.ok(s.seconds! > before - 2000 * secPerM - 60, "con số tụt theo cú nhảy");
  });

  test("GPS rung qua lại lúc đứng yên không dồn thành quãng đường", () => {
    // So với chính nó đứng yên tuyệt đối: hệ số nhạt dần theo thời gian ở cả hai.
    const r = drive(drive(begin(10_000), 20, 1), 20, 2);
    let shaking = r.t;
    let still = r.t;
    for (let i = 0; i < 60; i++) {
      const at = r.at + i * 2000;
      const jitter = i % 2 === 0 ? 8 : -8;
      shaking = stepEta(shaking, { at, remainingM: r.rem + jitter, deviationM: 5, secPerM }).tracker;
      still = stepEta(still, { at, remainingM: r.rem, deviationM: 5, secPerM }).tracker;
    }
    const ghost = shaking.plannedS - still.plannedS;
    assert.ok(Math.abs(ghost) < 20 * secPerM, `rung ra ${ghost.toFixed(1)}s đường ma`);
  });

  test("lạc khỏi tuyến: thời gian không bị tính là chạy chậm trên tuyến", () => {
    const r = drive(drive(begin(10_000), 20, 1), 20, 2);
    const off = drive(r, 0, 2, 200);
    assert.equal(off.t.elapsedS, r.t.elapsedS);
  });

  test("giờ đến đứng yên thì số phút đếm lùi đều", () => {
    const r = drive(begin(10_000), PLAN_KMH, 20);
    const steps = r.shown.slice(3).map((m, i) => r.shown[i + 2] - m);
    assert.ok(steps.every((d) => d >= 0 && d <= 2), `đếm lùi không đều: ${r.shown.join(" ")}`);
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
