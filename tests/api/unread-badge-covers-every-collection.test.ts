/*
 * Huy hiệu "chưa đọc" phải đếm ĐỦ CHÍN bảng.
 *
 * Con số này gộp từ chín collection trong MỘT aggregate `$unionWith`. Bỏ sót
 * một nhánh thì huy hiệu vẫn hiện, vẫn có số, chỉ là thiếu — không màn hình
 * nào tố cáo, và không bài kiểm nào trước đây bắt được: gỡ hẳn nhánh
 * `mediaitems` ra thì cả bộ `read-surfaces` vẫn xanh.
 *
 * Nên bài này ghim TỪNG nhánh một: mỗi bảng một bản ghi của người kia, rồi
 * đếm. Thiếu nhánh nào là lệch đúng một đơn vị ở đó.
 *
 * Ghi thẳng vào collection thay vì gọi API tạo: thứ đang kiểm là phạm vi của
 * phép đếm, không phải đường tạo dữ liệu — và chín đường tạo khác nhau sẽ kéo
 * theo chín bộ input hợp lệ chẳng liên quan gì tới câu hỏi ở đây.
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { freshDatabase, closeDatabase, makeCouple } from "./_harness.ts";

let couple: Awaited<ReturnType<typeof makeCouple>>;

/** Bảng → cách đánh dấu "người kia tạo cái này". */
const SOURCES: Array<{ coll: string; owner: "createdBy" | "creatorId"; extra?: Record<string, unknown> }> = [
  { coll: "memories", owner: "createdBy" },
  // `source: "suggested"` là quán do máy gợi ý — KHÔNG phải việc người kia làm,
  // nên bản ghi dưới đây cố ý không mang cờ đó.
  { coll: "locations", owner: "createdBy" },
  { coll: "planitems", owner: "createdBy" },
  { coll: "trips", owner: "createdBy" },
  { coll: "timecapsules", owner: "creatorId" },
  { coll: "wishlistitems", owner: "createdBy" },
  { coll: "mediaitems", owner: "createdBy" },
  { coll: "roadmapplans", owner: "createdBy" },
  { coll: "specialdates", owner: "createdBy" },
];

before(async () => {
  await freshDatabase();
  couple = await makeCouple({ a: "An", b: "Bình" });
});

after(closeDatabase);

describe("huy hiệu chưa đọc", () => {
  test("đếm đủ cả chín bảng, mỗi bảng một cái", async () => {
    const db = mongoose.connection.db!;
    for (const s of SOURCES) {
      await db.collection(s.coll).insertOne({
        spaceId: couple.spaceId,
        [s.owner]: couple.b.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...s.extra,
      });
    }
    const { count } = await couple.a.caller.activity.unreadCount();
    assert.equal(count, SOURCES.length, `thiếu nhánh nào đó — chờ ${SOURCES.length}, nhận ${count}`);
  });

  test("việc của CHÍNH MÌNH không lên huy hiệu của mình", async () => {
    const before = (await couple.a.caller.activity.unreadCount()).count;
    await mongoose.connection.db!.collection("memories").insertOne({
      spaceId: couple.spaceId, createdBy: couple.a.userId, createdAt: new Date(), updatedAt: new Date(),
    });
    assert.equal((await couple.a.caller.activity.unreadCount()).count, before);
  });

  test("quán do máy gợi ý không lên huy hiệu", async () => {
    const before = (await couple.a.caller.activity.unreadCount()).count;
    await mongoose.connection.db!.collection("locations").insertOne({
      spaceId: couple.spaceId, createdBy: couple.b.userId, source: "suggested",
      createdAt: new Date(), updatedAt: new Date(),
    });
    assert.equal((await couple.a.caller.activity.unreadCount()).count, before);
  });

  test("việc của cặp khác không lọt sang", async () => {
    const before = (await couple.a.caller.activity.unreadCount()).count;
    await mongoose.connection.db!.collection("memories").insertOne({
      spaceId: "khong-phai-khong-gian-nay", createdBy: couple.b.userId,
      createdAt: new Date(), updatedAt: new Date(),
    });
    assert.equal((await couple.a.caller.activity.unreadCount()).count, before);
  });
});
