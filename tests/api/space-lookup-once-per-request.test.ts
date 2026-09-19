/*
 * Một request tra không gian ĐÚNG MỘT LẦN, dù mẻ có bao nhiêu thủ tục.
 *
 * `httpBatchLink` gộp nhiều thủ tục vào một request HTTP, nhưng middleware thì
 * chạy lại cho TỪNG thủ tục — nên màn hình đầu tiên (4 thủ tục trong một mẻ)
 * từng gửi bốn lần cùng một `SpaceModel.find({ members })` xuống Atlas trước
 * khi có bất kỳ việc thật nào. RTT đo được 130ms, tức ~390ms trả cho số không.
 *
 * Hai nửa, và nửa thứ hai mới là nửa suýt lên production:
 *   1. đếm đúng một lần — chính là phần tăng tốc;
 *   2. gọi lần thứ hai KHÔNG được ném. Bản đầu nhớ nhầm `Query` của Mongoose
 *      thay vì `Promise`; một Query chỉ chạy được một lần nên `await` lần hai
 *      ném "Query was already executed" — tức thủ tục thứ hai của MỌI mẻ hỏng.
 *      `tsc`, `eslint` và 111 bài unit đều xanh với lỗi đó; 218 bài API đỏ mới
 *      là thứ bắt được.
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { SpaceModel } from "@/server/db/models/space";
import { freshDatabase, closeDatabase, makeCouple, callerFor } from "./_harness.ts";

let couple: Awaited<ReturnType<typeof makeCouple>>;

before(async () => {
  await freshDatabase();
  couple = await makeCouple({ a: "An", b: "Bình" });
});

after(closeDatabase);

describe("một request chỉ tra không gian một lần", () => {
  test("bốn thủ tục trên cùng một caller = một truy vấn, và không ném", async () => {
    /*
     * Caller MỚI = request mới.
     *
     * Dùng lại caller dựng ở `before` thì nó đã tra từ lúc seed dữ liệu và bộ
     * đếm ra 0 — đúng là bằng chứng việc nhớ có tác dụng, nhưng không phải thứ
     * bài này muốn đo. Một request thật bắt đầu với bộ nhớ trắng.
     */
    const caller = callerFor({
      userId: couple.a.userId,
      userEmail: couple.a.email,
      activeSpaceId: couple.spaceId,
    });

    const real = SpaceModel.find.bind(SpaceModel);
    let members = 0;
    // Chỉ đếm truy vấn THÀNH VIÊN: các router khác cũng gọi find() cho việc riêng.
    (SpaceModel as unknown as { find: unknown }).find = ((filter?: Record<string, unknown>, ...rest: unknown[]) => {
      if (filter && Object.prototype.hasOwnProperty.call(filter, "members")) members++;
      return (real as unknown as (...a: unknown[]) => unknown)(filter, ...rest);
    }) as unknown;

    try {
      await caller.specialDate.list();
      await caller.specialDate.list();
      await caller.specialDate.myBirthday();
      await caller.specialDate.list();
    } finally {
      (SpaceModel as unknown as { find: unknown }).find = real;
    }

    assert.equal(members, 1, `tra không gian ${members} lần cho 4 thủ tục — phải đúng 1`);
  });
});
