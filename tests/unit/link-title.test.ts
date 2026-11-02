/*
 * The library form's title, from the link being pasted.
 *
 * What matters beyond "it reads the title": only the three providers are ever
 * asked, a link to anywhere else causes no request at all, and a provider that
 * is down or answers junk gives "no title" rather than an error in the form.
 */
import test, { describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { cleanTitle, linkTitle } from "@/server/lib/link-title";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function stub(answer: (url: string) => Response) {
  const asked: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    asked.push(url);
    return answer(url);
  }) as typeof fetch;
  return asked;
}

describe("linkTitle", () => {
  test("YouTube: asks YouTube's oEmbed, with the link as a parameter", async () => {
    const asked = stub(() => Response.json({ title: "Mỹ Tâm - Ước Gì (Official MV)" }));
    const r = await linkTitle("https://www.youtube.com/watch?v=abcdefghijk");
    assert.equal(r.title, "Mỹ Tâm - Ước Gì (Official MV)");
    assert.equal(asked.length, 1);
    assert.ok(asked[0].startsWith("https://www.youtube.com/oembed?"));
  });

  test("Spotify: its own oEmbed", async () => {
    const asked = stub(() => Response.json({ title: "Có Chắc Yêu Là Đây" }));
    const r = await linkTitle("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
    assert.equal(r.title, "Có Chắc Yêu Là Đây");
    assert.ok(asked[0].startsWith("https://open.spotify.com/oembed?"));
  });

  test("TikTok: the caption without its hashtags", async () => {
    stub((url) => (url.includes("/oembed") ? Response.json({ title: "Bún bò Huế ngon nhất Sài Gòn #food #review #xuhuong" }) : new Response(null, { status: 200 })));
    const r = await linkTitle("https://www.tiktok.com/@an/video/7519906759750847762");
    assert.equal(r.title, "Bún bò Huế ngon nhất Sài Gòn");
  });

  test("a link to anywhere else is never fetched", async () => {
    const asked = stub(() => Response.json({ title: "should not be read" }));
    for (const url of ["https://example.com/a", "https://169.254.169.254/latest/meta-data", "https://shopee.vn/x-i.1.2"]) {
      assert.equal((await linkTitle(url)).title, null, url);
    }
    assert.deepEqual(asked, []);
  });

  test("a provider that is down, refuses, or answers junk gives no title", async () => {
    stub(() => new Response("", { status: 404 }));
    assert.equal((await linkTitle("https://youtu.be/abcdefghijk")).title, null);
    stub(() => new Response("not json", { status: 200 }));
    assert.equal((await linkTitle("https://youtu.be/abcdefghijk")).title, null);
    stub(() => Response.json({ title: 42 }));
    assert.equal((await linkTitle("https://youtu.be/abcdefghijk")).title, null);
    globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
    assert.equal((await linkTitle("https://youtu.be/abcdefghijk")).title, null);
  });
});

describe("cleanTitle", () => {
  test("only hashtags is no title; long ones are cut to the library's limit", () => {
    assert.equal(cleanTitle("#fyp #xuhuong"), null);
    assert.equal(cleanTitle("   "), null);
    assert.equal(cleanTitle("a".repeat(400))?.length, 160);
  });
});
