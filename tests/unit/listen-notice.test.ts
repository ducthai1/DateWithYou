import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { clock, followTarget, noticeText, partnerAction } from "@/lib/listen-notice";

/*
 * Chủ repo 26/10: người kia tua/dừng thì màn hình phải nói đó là NGƯỜI KIA,
 * không thì một cú dừng trông như treo, một cú nhảy trông như mạng giật.
 */

const base = { isPlaying: true, index: 0, epoch: 3 };
const next = (o: Partial<typeof base & { positionSec: number; trackTitle: string }>) => ({
  ...base, positionSec: 60, trackTitle: "Bài hai", ...o,
});

describe("người kia vừa làm gì", () => {
  test("dừng", () => assert.deepEqual(partnerAction(base, next({ epoch: 4, isPlaying: false }), 60), { kind: "pause" }));
  test("phát tiếp", () =>
    assert.deepEqual(partnerAction({ ...base, isPlaying: false }, next({ epoch: 4 }), 60), { kind: "resume" }));
  test("chuyển bài thắng mọi thứ đi kèm", () =>
    assert.deepEqual(partnerAction(base, next({ epoch: 4, index: 1, isPlaying: false }), 60), { kind: "track", title: "Bài hai" }));
  test("tua tới / tua lại tính theo chỗ máy mình đang đứng", () => {
    assert.deepEqual(partnerAction(base, next({ epoch: 4, positionSec: 70 }), 20), { kind: "seek", to: 70, forward: true });
    assert.deepEqual(partnerAction(base, next({ epoch: 4, positionSec: 10 }), 50), { kind: "seek", to: 10, forward: false });
  });
  test("không có lệnh mới (cùng epoch) thì không nói gì — đó chỉ là máy kia ghi vị trí", () =>
    assert.equal(partnerAction(base, next({ positionSec: 300 }), 10), null));
  test("lệnh mà vị trí gần như trùng chỗ mình thì không đáng một câu", () =>
    assert.equal(partnerAction(base, next({ epoch: 4, positionSec: 60.5 }), 60), null));
  test("chưa theo gì trước đó (vừa mở) thì không thông báo", () =>
    assert.equal(partnerAction(null, next({ epoch: 4, isPlaying: false }), 60), null));
});

describe("câu chữ", () => {
  test("có tên người kia, có giờ phút", () => {
    assert.equal(noticeText({ kind: "pause" }, "Ngọc"), "Ngọc vừa tạm dừng");
    assert.equal(noticeText({ kind: "seek", to: 70, forward: true }, "Ngọc"), "Ngọc vừa tua tới 1:10");
    assert.equal(noticeText({ kind: "seek", to: 5, forward: false }, "Ngọc"), "Ngọc vừa tua lại 0:05");
    assert.equal(noticeText({ kind: "track", title: "Hello" }, "Ngọc"), "Ngọc chuyển sang “Hello”");
  });
  test("đồng hồ", () => {
    assert.equal(clock(0), "0:00");
    assert.equal(clock(59.9), "0:59");
    assert.equal(clock(3723), "1:02:03");
    assert.equal(clock(-3), "0:00");
  });
});

describe("có nên di chuyển máy mình để theo không", () => {
  const tol = { commandTolerance: 0.75, driftTolerance: 2.5 };
  test("lệnh: theo cả hai chiều", () => {
    assert.equal(followTarget(100, 40, { command: true, ...tol }), 40);
    assert.equal(followTarget(40, 100, { command: true, ...tol }), 100);
    assert.equal(followTarget(100, 100.5, { command: true, ...tol }), null);
  });
  test("ghi vị trí định kỳ: chỉ kéo TỚI khi mình bị tụt — không bao giờ kéo lùi", () => {
    assert.equal(followTarget(95, 100, { command: false, ...tol }), 100, "mình tụt 5 giây: bắt kịp");
    assert.equal(followTarget(100, 95, { command: false, ...tol }), null, "mình đi trước: để máy kia đuổi, đừng giật lùi");
    assert.equal(followTarget(99, 100, { command: false, ...tol }), null, "lệch dưới ngưỡng: im");
  });
});
