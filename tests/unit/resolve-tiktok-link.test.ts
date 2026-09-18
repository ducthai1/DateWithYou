import test, { describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { canonicalTikTokUrl } from "@/server/lib/resolve-tiktok-link";

/*
 * Giải link TikTok rút gọn.
 *
 * Bấm Chia sẻ trong app TikTok ra `vm.tiktok.com/XXXX/` — dạng link người ta
 * thực sự dán vào. Nó không mang id bài viết, mà cả `embedUrl` lưu ở server lẫn
 * trình phát ở client đều dựng từ id ⇒ không giải được là không xem được.
 *
 * Mọi bài ở đây thay `fetch` bằng bản giả để đo đúng LUẬT đi theo chuyển
 * hướng, không phụ thuộc mạng và không gõ vào TikTok mỗi lần chạy test.
 */

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

/** `fetch` giả: tra bảng url → Location (null nghĩa là không có header đó). */
function stubRedirects(table: Record<string, string | null>) {
  const seen: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    seen.push(url);
    if (!(url in table)) throw new Error(`fetch không mong đợi: ${url}`);
    const loc = table[url];
    return new Response(null, { status: loc ? 302 : 200, headers: loc ? { location: loc } : {} });
  }) as typeof fetch;
  return seen;
}

const LONG = "https://www.tiktok.com/@ai/video/7519906759750847762";

describe("canonicalTikTokUrl", () => {
  test("link rút gọn thành link mang id", async () => {
    stubRedirects({ "https://vm.tiktok.com/ZSAhnmuJW/": LONG });
    assert.equal(await canonicalTikTokUrl("https://vm.tiktok.com/ZSAhnmuJW/"), LONG);
  });

  test("link dài không cần đi mạng", async () => {
    const seen = stubRedirects({});
    assert.equal(await canonicalTikTokUrl(LONG), LONG);
    assert.deepEqual(seen, []);
  });

  test("link dài dán từ trình duyệt cũng bị rửa tham số", async () => {
    // Cùng một video dán hai kiểu (chia sẻ từ app / copy từ thanh địa chỉ) phải
    // ra CÙNG một URL, không thì không chỗ nào nhận ra đó là một bài.
    const seen = stubRedirects({});
    assert.equal(await canonicalTikTokUrl(`${LONG}?is_from_webapp=1&sender_device=pc`), LONG);
    assert.deepEqual(seen, []);
  });

  test("dạng /t/ cũng là link rút gọn", async () => {
    stubRedirects({ "https://www.tiktok.com/t/ZSAhnmuJW/": LONG });
    assert.equal(await canonicalTikTokUrl("https://www.tiktok.com/t/ZSAhnmuJW/"), LONG);
  });

  test("cắt chuỗi tham số theo dõi khỏi link trả về", async () => {
    // Chuyển hướng thật mang theo `_r`, `_d`, `share_item_id`, `timestamp`…
    // Giữ lại thì cùng một video lưu hai lần ra hai URL khác nhau.
    stubRedirects({
      "https://vm.tiktok.com/ZSAhnmuJW/": `${LONG}?_r=1&_d=secXYZ&share_item_id=751&timestamp=1755892334`,
    });
    const out = await canonicalTikTokUrl("https://vm.tiktok.com/ZSAhnmuJW/");
    assert.equal(out, LONG);
    assert.ok(!out!.includes("?"), "không được còn tham số nào");
  });

  test("đi qua nhiều chặng cho tới khi thấy id", async () => {
    stubRedirects({
      "https://vm.tiktok.com/AAA/": "https://vt.tiktok.com/BBB/",
      "https://vt.tiktok.com/BBB/": LONG,
    });
    assert.equal(await canonicalTikTokUrl("https://vm.tiktok.com/AAA/"), LONG);
  });

  test("bỏ cuộc sau đúng 3 chặng, không đi mãi", async () => {
    // Một dây chuyển hướng dài hơn trần. Bài này ghim CHÍNH con số: nới trần
    // lên thì nó đỏ, còn bài vòng lặp bên dưới thì không — vòng lặp vẫn kết
    // thúc ở mọi trần hữu hạn nên nó không gác được gì.
    const chain: Record<string, string> = {};
    for (let i = 0; i < 10; i++) chain[`https://vm.tiktok.com/H${i}/`] = `https://vm.tiktok.com/H${i + 1}/`;
    const seen = stubRedirects(chain);
    assert.equal(await canonicalTikTokUrl("https://vm.tiktok.com/H0/"), null);
    assert.equal(seen.length, 3, "phải dừng đúng ở trần, không đi hết dây");
  });

  test("vòng lặp chuyển hướng dừng lại, không treo", async () => {
    stubRedirects({
      "https://vm.tiktok.com/AAA/": "https://vm.tiktok.com/BBB/",
      "https://vm.tiktok.com/BBB/": "https://vm.tiktok.com/AAA/",
    });
    assert.equal(await canonicalTikTokUrl("https://vm.tiktok.com/AAA/"), null);
  });

  /*
   * Hàng rào SSRF.
   *
   * Đây là máy chủ đi lấy một URL do người dùng đưa vào. Đi theo một chuyển
   * hướng trỏ ra ngoài TikTok là biến tính năng này thành cái proxy dò mạng nội
   * bộ. Ranh giới phải được kiểm ở MỌI chặng, không chỉ chặng đầu — nên có hẳn
   * một bài cho chặng thứ hai.
   */
  test("không nhận host ngoài TikTok ngay từ đầu vào", async () => {
    const seen = stubRedirects({});
    assert.equal(await canonicalTikTokUrl("https://evil.example.com/@a/video/123"), null);
    assert.deepEqual(seen, [], "không được gọi mạng tới host lạ");
  });

  test("không đi theo chuyển hướng trỏ ra ngoài TikTok", async () => {
    const seen = stubRedirects({ "https://vm.tiktok.com/AAA/": "http://169.254.169.254/latest/meta-data/" });
    assert.equal(await canonicalTikTokUrl("https://vm.tiktok.com/AAA/"), null);
    assert.deepEqual(seen, ["https://vm.tiktok.com/AAA/"], "dừng lại, không gọi tiếp địa chỉ nội bộ");
  });

  test("host chỉ CHỨA chữ tiktok.com không được tính là TikTok", async () => {
    const seen = stubRedirects({});
    assert.equal(await canonicalTikTokUrl("https://tiktok.com.evil.test/t/AAA/"), null);
    assert.deepEqual(seen, []);
  });

  test("mạng hỏng thì trả null chứ không ném", async () => {
    globalThis.fetch = (async () => { throw new Error("mất mạng"); }) as typeof fetch;
    assert.equal(await canonicalTikTokUrl("https://vm.tiktok.com/AAA/"), null);
  });

  test("không có Location thì dừng", async () => {
    stubRedirects({ "https://vm.tiktok.com/AAA/": null });
    assert.equal(await canonicalTikTokUrl("https://vm.tiktok.com/AAA/"), null);
  });

  test("chuỗi không phải URL thì trả null", async () => {
    assert.equal(await canonicalTikTokUrl("không phải url"), null);
  });
});
