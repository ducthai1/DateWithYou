import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { DOUBLE_BACK_MS, backIntent, stepsToLeaveApp } from "@/lib/back-intent";

/*
 * Nút back của điện thoại.
 *
 * Ba triệu chứng thật, không phải giả định: đang xem ảnh toàn màn hình mà bấm
 * back thì ra một màn đen ghi "0/0" rồi bị đá về trang trước; bấm back nhiều
 * lần thì lùi mãi qua từng route đã đi thay vì thoát; và thứ tự ưu tiên giữa
 * hai luật đó quyết định xem người đang vuốt ảnh có bị văng khỏi app không.
 */

describe("backIntent", () => {
  test("đang xem ảnh thì chỉ đóng ảnh", () => {
    assert.equal(backIntent({ photoViewerOpen: true, lastBackAt: 0, now: 1000 }), "close-photo");
  });

  /*
   * Bài đắt nhất ở đây.
   *
   * Vuốt xem ảnh thì hai cú back sát nhau là chuyện thường. Nếu xét "hai lần
   * liên tiếp" TRƯỚC khi xét ảnh thì cú thứ hai đá người ta ra khỏi app trong
   * lúc họ chỉ định đóng cái ảnh đang xem.
   */
  test("ảnh được xét TRƯỚC, kể cả khi vừa bấm back xong", () => {
    assert.equal(
      backIntent({ photoViewerOpen: true, lastBackAt: 1000, now: 1000 + DOUBLE_BACK_MS - 1 }),
      "close-photo",
    );
  });

  test("lần đầu, không có gì để đóng: để trang lùi như thường", () => {
    assert.equal(backIntent({ photoViewerOpen: false, lastBackAt: 0, now: 5000 }), "navigate");
  });

  test("bấm lần hai ngay sau đó: thoát", () => {
    assert.equal(
      backIntent({ photoViewerOpen: false, lastBackAt: 1000, now: 1000 + DOUBLE_BACK_MS - 1 }),
      "exit",
    );
  });

  test("bấm lần hai quá chậm: lùi như thường, không thoát", () => {
    assert.equal(
      backIntent({ photoViewerOpen: false, lastBackAt: 1000, now: 1000 + DOUBLE_BACK_MS }),
      "navigate",
    );
    assert.equal(
      backIntent({ photoViewerOpen: false, lastBackAt: 1000, now: 1000 + DOUBLE_BACK_MS + 5000 }),
      "navigate",
    );
  });

  test("mốc 0 không bao giờ là thoát, kể cả ở thời điểm 0", () => {
    // `lastBackAt: 0` nghĩa là "chưa có lần nào", không phải "lúc 0ms".
    assert.equal(backIntent({ photoViewerOpen: false, lastBackAt: 0, now: 0 }), "navigate");
  });
});

describe("stepsToLeaveApp", () => {
  test("app chưa đi đâu thì lùi một nấc là ra", () => {
    assert.equal(stepsToLeaveApp(5, 5), 1);
  });

  test("đi bốn route thì lùi năm nấc", () => {
    assert.equal(stepsToLeaveApp(9, 5), 5);
  });

  /*
   * `history.length` không giảm khi pop, nên nó có thể NHỎ hơn mốc đầu nếu
   * trình duyệt cắt bớt nhánh đi tới. Thiếu một nấc thì người ta bấm back mà
   * vẫn ở trong app — đúng cái bug đang sửa. Thừa thì cùng lắm ra sớm.
   */
  test("số đo lệch về phía nhỏ vẫn không bao giờ ra 0 nấc", () => {
    assert.equal(stepsToLeaveApp(3, 10), 1);
  });
});
