import test, { describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { resolveEmbed } from "@/server/lib/resolve-embed";

/*
 * Làm giàu link trước khi lưu.
 *
 * Hai đường phát TikTok phải nói cùng một chuyện: `embedUrl` lưu ở server, và
 * id mà trình phát ở client tự đọc ra từ `url` của hàng. Nên `url` lưu xuống
 * phải là link ĐÃ GIẢI, không phải link người dùng dán.
 */

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const ID = "7519906759750847762";
const LONG = `https://www.tiktok.com/@ai/video/${ID}`;

/** Giả cả hai cuộc gọi: chuyển hướng của link rút gọn, và oEmbed. */
function stub(opts: { redirect?: string | null; oembed?: object | number }) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/oembed")) {
      if (typeof opts.oembed === "number") return new Response("", { status: opts.oembed });
      return Response.json(opts.oembed ?? {});
    }
    const loc = opts.redirect;
    return new Response(null, { status: loc ? 302 : 200, headers: loc ? { location: loc } : {} });
  }) as typeof fetch;
}

describe("resolveEmbed — TikTok", () => {
  test("link rút gọn: lưu link đã giải, dựng được trình phát", async () => {
    stub({ redirect: LONG, oembed: { thumbnail_url: "https://cdn.test/t.jpg", title: "Bún bò" } });
    const r = await resolveEmbed("https://vm.tiktok.com/ZSAhnmuJW/");
    assert.equal(r.url, LONG, "phải lưu link đã giải, không phải link dán vào");
    assert.equal(r.embedId, ID);
    assert.ok(r.embedUrl?.includes(`/player/v1/${ID}`));
    assert.equal(r.thumbnailUrl, "https://cdn.test/t.jpg");
    assert.equal(r.title, "Bún bò");
  });

  /*
   * Bài đắt nhất ở đây.
   *
   * Khi không giải được, mã rút gọn (`ZSAhnmuJW`) vẫn nằm sẵn trong `embedId`.
   * Ghép nó vào URL trình phát thì TikTok đáp HTTP 200 — nhưng là 200 của một
   * trang lỗi nằm gọn trong khung, nên nhìn từ ngoài chỉ thấy một ô đen im
   * lặng. Một thẻ link bấm được thì thành thật hơn.
   */
  test("không giải được: giữ nguyên thẻ link, KHÔNG dựng trình phát", async () => {
    stub({ redirect: null });
    const r = await resolveEmbed("https://vm.tiktok.com/ZSAhnmuJW/");
    assert.equal(r.embedUrl, null, "mã rút gọn không được thành URL trình phát");
    assert.equal(r.url, "https://vm.tiktok.com/ZSAhnmuJW/");
    assert.equal(r.provider, "tiktok", "vẫn dán nhãn TikTok để hiện đúng thẻ");
  });

  test("oEmbed hỏng vẫn lưu được, chỉ thiếu ảnh bìa", async () => {
    stub({ redirect: LONG, oembed: 400 });
    const r = await resolveEmbed("https://vm.tiktok.com/ZSAhnmuJW/");
    assert.ok(r.embedUrl?.includes(`/player/v1/${ID}`), "video vẫn phải phát được");
    assert.equal(r.thumbnailUrl, null);
    assert.equal(r.title, null);
  });

  test("link dài: id lấy thẳng từ URL", async () => {
    stub({ oembed: { title: "x" } });
    const r = await resolveEmbed(LONG);
    assert.equal(r.url, LONG);
    assert.ok(r.embedUrl?.includes(`/player/v1/${ID}`));
  });

  test("dùng /player/v1/, không phải /embed/v2/", async () => {
    // Hai nơi từng dựng hai endpoint khác nhau cho cùng một khung. `/embed/v2/`
    // trả 400 với id không giải được, nên một id hỏng ở đường đó là khung trắng.
    stub({ redirect: LONG, oembed: {} });
    const r = await resolveEmbed("https://vm.tiktok.com/ZSAhnmuJW/");
    assert.ok(!r.embedUrl?.includes("/embed/v2/"));
  });

  test("nhà cung cấp khác không bị đụng tới", async () => {
    globalThis.fetch = (async () => { throw new Error("không được gọi mạng"); }) as typeof fetch;
    const r = await resolveEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    assert.equal(r.provider, "youtube");
    assert.equal(r.embedId, "dQw4w9WgXcQ");
  });
});
