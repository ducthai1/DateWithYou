import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { FRESH_TRACKER, listenDelivery, refreshAccepted, type ListenTracker } from "@/lib/listen-delivery";

/*
 * Mỗi lượt poll của stream quyết định: có đẩy trạng thái xem chung cho máy này
 * không. Chủ repo báo 26/10 tua không đồng bộ: cú tua chỉ đổi VỊ TRÍ, mà bản cũ
 * nhận ra lệnh qua "đang phát? bài nào?" — nên cú tua bị coi là không có gì mới
 * mỗi khi máy kia vừa ghi đè vị trí của nó lên.
 */

const ME = "me";
const PARTNER = "partner";
const at = (epoch: number, stateAt: number): ListenTracker => ({ epoch, stateAt });

describe("lệnh (epoch mới)", () => {
  test("lệnh của người kia được đẩy — kể cả cú tua, vốn không đổi đang phát hay bài", () => {
    const r = listenDelivery(at(4, 1000), { epoch: 5, commandBy: PARTNER, updatedBy: PARTNER, stateAtMs: 2000 }, ME);
    assert.equal(r.send, true);
    assert.deepEqual(r.next, at(5, 2000));
  });

  test("lệnh của chính mình không dội lại (dội lại là khởi đầu một cuộc giằng co tua)", () => {
    const r = listenDelivery(at(4, 1000), { epoch: 5, commandBy: ME, updatedBy: ME, stateAtMs: 2000 }, ME);
    assert.equal(r.send, false);
    assert.deepEqual(r.next, at(5, 2000), "vẫn phải ghi nhận là đã tính tới");
  });

  test("lệnh của người kia, rồi mình ghi vị trí định kỳ ngay sau: vẫn đẩy lệnh", () => {
    // Mình đã theo lệnh nên bản ghi của mình được chấp nhận: updatedBy = me, nhưng commandBy vẫn là người kia.
    const r = listenDelivery(at(4, 1000), { epoch: 5, commandBy: PARTNER, updatedBy: ME, stateAtMs: 2500 }, ME);
    assert.equal(r.send, true);
  });

  test("kết nối mới: lệnh cuối là của người kia thì đẩy, của mình thì không", () => {
    assert.equal(listenDelivery(FRESH_TRACKER, { epoch: 2, commandBy: PARTNER, updatedBy: PARTNER, stateAtMs: 1 }, ME).send, true);
    assert.equal(listenDelivery(FRESH_TRACKER, { epoch: 2, commandBy: ME, updatedBy: PARTNER, stateAtMs: 1 }, ME).send, false);
  });
});

describe("ghi vị trí định kỳ (cùng epoch)", () => {
  test("của người kia: đẩy, để máy này biết mình có trôi lệch không", () => {
    const r = listenDelivery(at(5, 2000), { epoch: 5, commandBy: ME, updatedBy: PARTNER, stateAtMs: 3000 }, ME);
    assert.equal(r.send, true);
    assert.deepEqual(r.next, at(5, 3000));
  });

  test("của chính mình: nuốt", () => {
    const r = listenDelivery(at(5, 2000), { epoch: 5, commandBy: PARTNER, updatedBy: ME, stateAtMs: 3000 }, ME);
    assert.equal(r.send, false);
  });

  test("không có gì mới: không đẩy, không đổi gì", () => {
    const prev = at(5, 3000);
    const r = listenDelivery(prev, { epoch: 5, commandBy: PARTNER, updatedBy: PARTNER, stateAtMs: 3000 }, ME);
    assert.equal(r.send, false);
    assert.equal(r.next, prev);
  });
});

describe("phiên ghi trước khi có epoch", () => {
  test("không có epoch thì coi là 0, không có commandBy thì người ghi cuối là người ra lệnh", () => {
    const r = listenDelivery(FRESH_TRACKER, { updatedBy: PARTNER, stateAtMs: 10 }, ME);
    assert.equal(r.send, true);
    assert.equal(r.next.epoch, 0);
  });
});

describe("server có nhận bản ghi định kỳ không", () => {
  test("chỉ nhận từ máy đã theo lệnh mới nhất", () => {
    assert.equal(refreshAccepted(5, 5), true);
    assert.equal(refreshAccepted(5, 4), false, "máy chưa nghe cú tua mà ghi vị trí cũ đè lên — đúng cái lỗi đã gặp");
  });
  test("phiên cũ không có epoch là 0; app cũ không gửi epoch thì vẫn nhận như trước", () => {
    assert.equal(refreshAccepted(undefined, 0), true);
    assert.equal(refreshAccepted(null, 0), true);
    assert.equal(refreshAccepted(7, undefined), true);
  });
});
