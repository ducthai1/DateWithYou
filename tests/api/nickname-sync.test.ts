/*
 * Đổi biệt danh thì mọi nơi dùng nó phải đổi theo.
 *
 * Người dùng báo: "có nơi có đổi nơi thì lại là tên biệt danh cũ… hoặc ở phần
 * hôm nay thì kêu là sắp tới sinh nhật của biệt danh cũ". Hai nguyên nhân khác
 * nhau, và bài kiểm này gác cả hai:
 *
 *   - Dòng sinh nhật lưu tên NGAY TRONG tiêu đề ("Sinh nhật Bé"). Không viết
 *     lại lúc đổi tên thì nó mang tên cũ mãi mãi — không có gì tự chữa.
 *   - Thẻ tên trong chú thích dò theo CHỮ, nên tên cũ phải được giữ lại làm
 *     alias, nếu không mọi "@TênCũ" đã viết sẽ tụt xuống thành chữ thường.
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, closeDatabase, makeCouple, must } from "./_harness.ts";

let couple: Awaited<ReturnType<typeof makeCouple>>;

before(async () => {
  await freshDatabase();
  couple = await makeCouple({ a: "An", b: "Bình" });
});

after(closeDatabase);

/** Dòng sinh nhật của một người trong không gian này. */
async function birthdayTitle(userId: string): Promise<string | null> {
  const { SpecialDateModel } = await import("../../src/server/db/models/special-date.ts");
  const row = await SpecialDateModel.findOne({ spaceId: couple.spaceId, birthdayOf: userId }).lean<{ title: string }>();
  return row?.title ?? null;
}

describe("đổi biệt danh", () => {
  test("dòng sinh nhật đổi tên theo, không giữ tên cũ", async () => {
    await couple.b.caller.specialDate.setMyBirthday({ date: "1999-03-14" });
    assert.equal(await birthdayTitle(couple.b.userId), "Sinh nhật Bình", "mốc ban đầu");

    await couple.a.caller.space.setNickname({ userId: couple.b.userId, nickname: "Bé" });
    assert.equal(await birthdayTitle(couple.b.userId), "Sinh nhật Bé");

    // Đổi lần nữa: vẫn phải theo kịp, không mắc kẹt ở lần đầu.
    await couple.a.caller.space.setNickname({ userId: couple.b.userId, nickname: "Mèo" });
    assert.equal(await birthdayTitle(couple.b.userId), "Sinh nhật Mèo");
  });

  test("alias chỉ còn tên ĐANG dùng — tên cũ không được giữ lại", async () => {
    const rows = await couple.a.caller.space.members();
    const her = must(rows.find((m) => m.id === couple.b.userId));
    assert.equal(her.name, "Mèo", "hiển thị bằng tên đang dùng");
    assert.deepEqual([...her.aliases].sort(), ["Bình", "Mèo"], JSON.stringify(her.aliases));
    assert.ok(!her.aliases.includes("Bé"), "tên đã bỏ không được sống sót ở đâu cả");
  });

  /*
   * Bài quan trọng nhất của cả tệp.
   *
   * Chữ ĐÃ LƯU phải đổi, không chỉ chữ hiển thị. Chỗ tên cũ lộ ra là ô nhập
   * lúc mở kỷ niệm ra sửa — nó hiện đúng chuỗi trong database, nên chỉ đổi
   * tầng hiển thị là người dùng vẫn gặp lại tên cũ.
   */
  test("chú thích và ghi chú đã lưu được viết lại theo tên mới", async () => {
    const memo = await couple.b.caller.memory.create({
      title: "Đi biển",
      date: new Date("2026-05-01"),
      caption: "nhớ @Mèo ghê",
      photos: [{ url: "https://res.cloudinary.com/demo/image/upload/sample.jpg", publicId: "s1", caption: "@Mèo cười" }],
    });
    await couple.b.caller.interaction.addNote({
      targetType: "memory", targetId: memo.id, body: "@Mèo ơi xem nè", mentions: [couple.b.userId],
    });

    await couple.a.caller.space.setNickname({ userId: couple.b.userId, nickname: "Miu" });

    const after = must(await couple.b.caller.memory.get({ id: memo.id }));
    assert.equal(after.caption, "nhớ @Miu ghê", "chú thích chung");
    assert.equal(after.photos[0]?.caption, "@Miu cười", "chú thích của từng tấm ảnh");

    const notes = must(
      (await couple.a.caller.interaction.forTargets({ targetType: "memory", targetIds: [memo.id] }))[memo.id],
    ).notes;
    assert.equal(notes[0]?.body, "@Miu ơi xem nè", "ghi chú dưới bài");
  });

  test("viết lại KHÔNG đụng tới tên người khác nằm cạnh", async () => {
    const memo = await couple.b.caller.memory.create({
      title: "Hai tên", date: new Date("2026-05-02"), caption: "@An với @Miu đi chơi",
    });
    await couple.a.caller.space.setNickname({ userId: couple.b.userId, nickname: "Mun" });
    const after = must(await couple.b.caller.memory.get({ id: memo.id }));
    assert.equal(after.caption, "@An với @Mun đi chơi", "chỉ đổi đúng một cái tên");
  });

  test("xoá biệt danh thì quay về tên tài khoản, và tên vừa bỏ vẫn nhận ra được", async () => {
    await couple.a.caller.space.setNickname({ userId: couple.b.userId, nickname: "" });
    const her = must((await couple.a.caller.space.members()).find((m) => m.id === couple.b.userId));
    assert.equal(her.name, "Bình");
    assert.equal(await birthdayTitle(couple.b.userId), "Sinh nhật Bình");
  });

  test("đặt lại đúng tên cũ thì không nhân đôi trong alias", async () => {
    await couple.a.caller.space.setNickname({ userId: couple.b.userId, nickname: "Mèo" });
    const her = must((await couple.a.caller.space.members()).find((m) => m.id === couple.b.userId));
    const meo = her.aliases.filter((x) => x === "Mèo");
    assert.equal(meo.length, 1, JSON.stringify(her.aliases));
    assert.equal(her.name, "Mèo");
  });

  test("không ai đổi được biệt danh người ngoài không gian", async () => {
    const { rejects, makeMember } = await import("./_harness.ts");
    const outsider = await makeMember({ name: "Chi", spaceName: "Góc khác" });
    await rejects(
      () => couple.a.caller.space.setNickname({ userId: outsider.userId, nickname: "Ai đó" }),
      "FORBIDDEN",
    );
  });

  /*
   * Ca nguy hiểm thật: tên này là ĐẦU của tên kia.
   *
   * Đổi "An" mà dùng phép tìm chuỗi thô thì `"@An Nhiên"` bị cắn mất phần đầu
   * và biến thành `"@Bo Nhiên"` — một cái tên không có thật, trong chú thích
   * của người khác. Bộ dò `findMentionRanges` đã lo ranh giới chữ và luật "tên
   * dài thắng tên ngắn"; bài này là thứ giữ cho nó không bị thay bằng
   * `replaceAll` trong một lần dọn code sau này.
   */
  test("tên là tiền tố của tên khác: không được cắn nhầm", async () => {
    await couple.a.caller.space.setNickname({ userId: couple.a.userId, nickname: "An" });
    await couple.a.caller.space.setNickname({ userId: couple.b.userId, nickname: "An Nhiên" });
    const memo = await couple.b.caller.memory.create({
      title: "Tiền tố", date: new Date("2026-05-03"), caption: "@An Nhiên và @An cùng đi",
    });

    await couple.a.caller.space.setNickname({ userId: couple.a.userId, nickname: "Bo" });

    const after = must(await couple.b.caller.memory.get({ id: memo.id }));
    assert.equal(after.caption, "@An Nhiên và @Bo cùng đi", "chỉ cái tên đứng một mình mới đổi");
  });

});
