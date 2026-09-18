import test, { after, before, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, closeDatabase, makeMember, must } from "./_harness.ts";

/*
 * Bấm Lưu lại một hàng cũ thì link TikTok có được xử lý lại không?
 *
 * Câu hỏi này quan trọng vì nó quyết định người dùng có phải xoá đi dán lại
 * hay không. Hai đường lưu có hai điều kiện re-derive KHÁC nhau
 * (`media`: `patch.url !== undefined`; `memory`: `patch.embeds` có mặt), nên
 * phải đo từng đường chứ không suy từ đường kia.
 *
 * Cách dựng "hàng cũ": tạo trong lúc việc giải link KHÔNG dùng được. Ra đúng
 * thứ nằm trong database từ trước — link rút gọn, không id, không trình phát.
 * Nó cũng chính là kịch bản nền tảng deploy chặn được TikTok: hàng lưu lúc đó
 * là hàng hỏng, và bài này nói rằng lưu lại một lần nữa là chữa được.
 */

const SHORT = "https://vm.tiktok.com/ZSAhnmuJW/";
const ID = "7519906759750847762";
const LONG = `https://www.tiktok.com/@ai/video/${ID}`;

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

/** Mạng hỏng: giải link không được, y như trước khi có bản sửa. */
function offline() {
  globalThis.fetch = (async () => { throw new Error("không giải được"); }) as typeof fetch;
}

/** Mạng chạy: chuyển hướng trả link dài, oEmbed trả ảnh bìa. */
function online() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/oembed")) return Response.json({ thumbnail_url: "https://cdn.test/t.jpg", title: "Bún bò" });
    return new Response(null, { status: 302, headers: { location: LONG } });
  }) as typeof fetch;
}

let caller: Awaited<ReturnType<typeof makeMember>>["caller"];

before(async () => {
  await freshDatabase();
  ({ caller } = await makeMember({ name: "Mai" }));
});

after(closeDatabase);

describe("lưu lại một hàng cũ thì link TikTok được giải lại", () => {
  test("thư viện: hàng cũ là thẻ link, lưu lại là phát được", async () => {
    offline();
    const { id } = await caller.media.create({ kind: "food_video", title: "Clip cũ", url: SHORT, tags: [] });

    const before = must((await caller.media.list()).find((m) => m.id === id));
    assert.equal(before.url, SHORT, "hàng cũ giữ nguyên link rút gọn");
    assert.equal(before.embedUrl, null, "và không có trình phát — đúng triệu chứng user báo");

    // Chính là thao tác user làm: mở ra, không sửa gì, bấm Lưu.
    online();
    await caller.media.update({ id, kind: "food_video", title: "Clip cũ", url: SHORT, tags: [] });

    const after = must((await caller.media.list()).find((m) => m.id === id));
    assert.equal(after.url, LONG, "link đã giải được lưu đè");
    assert.ok(after.embedUrl?.includes(`/player/v1/${ID}`), "trình phát dựng được");
    assert.equal(after.thumbnailUrl, "https://cdn.test/t.jpg");
  });

  test("kỷ niệm: y hệt, qua mảng embeds", async () => {
    offline();
    const { id } = await caller.memory.create({
      title: "Hôm đó", date: new Date("2026-09-01"),
      embeds: [{ url: SHORT }], photos: [], tags: [], mentions: [],
    });

    const before = must(await caller.memory.get({ id })).embeds[0];
    assert.equal(before.url, SHORT);
    assert.equal(before.embedUrl ?? null, null);

    online();
    await caller.memory.update({
      id, title: "Hôm đó", date: new Date("2026-09-01"),
      embeds: [{ url: SHORT }], photos: [], tags: [], mentions: [],
    });

    const after = must(await caller.memory.get({ id })).embeds[0];
    assert.equal(after.url, LONG);
    assert.ok(after.embedUrl?.includes(`/player/v1/${ID}`));
  });

  /*
   * Lưu lại mà KHÔNG đụng tới link thì sao?
   *
   * `media.update` chỉ re-derive khi `url` có mặt trong patch. Form của app
   * luôn gửi `url`, nhưng một lời gọi chỉ đổi tiêu đề thì không — và lúc đó
   * hàng phải giữ nguyên, chứ không được bị xoá mất metadata.
   */
  test("patch không mang url thì metadata cũ không bị thổi bay", async () => {
    online();
    const { id } = await caller.media.create({ kind: "food_video", title: "Có sẵn", url: SHORT, tags: [] });
    const good = must((await caller.media.list()).find((m) => m.id === id));
    assert.ok(good.embedUrl?.includes("/player/v1/"));

    await caller.media.update({ id, title: "Đổi mỗi tên" });

    const after = must((await caller.media.list()).find((m) => m.id === id));
    assert.equal(after.title, "Đổi mỗi tên");
    assert.equal(after.url, good.url, "link giữ nguyên");
    assert.equal(after.embedUrl, good.embedUrl, "trình phát giữ nguyên");
  });
});
