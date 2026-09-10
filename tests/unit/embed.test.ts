import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isFeedProvider,
  normalizeUrl,
  parseEmbed,
  tiktokPlayerUrl,
  tiktokPostId,
} from "../../src/lib/embed.ts";

/*
 * The link parser, locked down.
 *
 * Every case here is a shape that has been pasted into the app for real, plus
 * one that cost an afternoon: TikTok's `/embed/v2/` endpoint answers HTTP 400
 * and every TikTok in the library was a frame that could not load. Nothing but
 * a test pinned to the endpoint stops that coming back after a refactor.
 */

test("YouTube: mọi kiểu link đều ra cùng một embed", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
  ]) {
    const e = parseEmbed(url);
    assert.equal(e.provider, "youtube", url);
    assert.equal(e.embedId, "dQw4w9WgXcQ", url);
    assert.equal(e.embedUrl, "https://www.youtube.com/embed/dQw4w9WgXcQ", url);
    assert.match(e.thumbnailUrl ?? "", /img\.youtube\.com/, url);
  }
});

test("Spotify: giữ đúng loại nội dung trong đường dẫn embed", () => {
  const track = parseEmbed("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT");
  assert.equal(track.provider, "spotify");
  assert.equal(track.embedUrl, "https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT");
  const list = parseEmbed("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M");
  assert.equal(list.embedUrl, "https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M");
});

test("TikTok: dùng endpoint player/v1, KHÔNG dùng embed/v2 (endpoint đó trả 400)", () => {
  const e = parseEmbed("https://www.tiktok.com/@someone/video/6718335390845095173");
  assert.equal(e.provider, "tiktok");
  assert.equal(e.embedId, "6718335390845095173");
  assert.match(e.embedUrl ?? "", /^https:\/\/www\.tiktok\.com\/player\/v1\/6718335390845095173\?/);
  assert.doesNotMatch(e.embedUrl ?? "", /embed\/v2/);
});

test("TikTok: link rút gọn không phát được, nhưng vẫn nhận đúng nhà cung cấp", () => {
  for (const url of ["https://vm.tiktok.com/ZSAbCdEf/", "https://www.tiktok.com/t/ZSAbCdEf/"]) {
    const e = parseEmbed(url);
    assert.equal(e.provider, "tiktok", url);
    assert.equal(e.embedUrl, null, url);
    assert.equal(tiktokPostId(url), null, url);
  }
});

test("tiktokPostId: chỉ trả id cho link dài, và chỉ cho TikTok", () => {
  assert.equal(tiktokPostId("https://www.tiktok.com/@a/video/6718335390845095173"), "6718335390845095173");
  assert.equal(tiktokPostId("https://www.tiktok.com/@a/photo/6718335390845095173"), "6718335390845095173");
  assert.equal(tiktokPostId("https://www.youtube.com/watch?v=x"), null);
  assert.equal(tiktokPostId(null), null);
  assert.equal(tiktokPostId("không phải url"), null);
});

test("tiktokPlayerUrl: mặc định im lặng và không tự phát; bật được từng thứ", () => {
  const off = new URL(tiktokPlayerUrl("123"));
  assert.equal(off.pathname, "/player/v1/123");
  for (const [k, v] of [["autoplay", "0"], ["loop", "0"], ["muted", "0"], ["rel", "0"], ["controls", "1"], ["native_context_menu", "0"]]) {
    assert.equal(off.searchParams.get(k), v, k);
  }
  const on = new URL(tiktokPlayerUrl("123", { autoplay: true, loop: true, muted: true, description: true, musicInfo: true }));
  for (const k of ["autoplay", "loop", "muted", "description", "music_info"]) {
    assert.equal(on.searchParams.get(k), "1", k);
  }
});

test("Instagram: bài, reel và reels đều ra /embed", () => {
  assert.equal(parseEmbed("https://www.instagram.com/p/CODE123/").embedUrl, "https://www.instagram.com/p/CODE123/embed");
  assert.equal(parseEmbed("https://www.instagram.com/reel/CODE123/").embedUrl, "https://www.instagram.com/reel/CODE123/embed");
  assert.equal(parseEmbed("https://www.instagram.com/reels/CODE123/").embedUrl, "https://www.instagram.com/reel/CODE123/embed");
});

test("Link lạ và link hỏng: không ném lỗi, chỉ là link thường", () => {
  for (const url of ["https://example.com/abc", "chuỗi bất kỳ", ""]) {
    const e = parseEmbed(url);
    assert.equal(e.provider, "other", url);
    assert.equal(e.embedUrl, null, url);
  }
});

test("normalizeUrl: người ta dán thiếu giao thức là chuyện thường", () => {
  assert.equal(normalizeUrl("youtube.com/watch?v=x"), "https://youtube.com/watch?v=x");
  assert.equal(normalizeUrl("http://youtu.be/x"), "https://youtu.be/x");
  assert.equal(normalizeUrl("  https://a.com/b  "), "https://a.com/b");
  assert.equal(normalizeUrl("   "), "");
});

test("isFeedProvider: chỉ TikTok mới đi màn hình lướt", () => {
  assert.equal(isFeedProvider("tiktok"), true);
  for (const p of ["youtube", "spotify", "instagram", "other", null, undefined]) {
    assert.equal(isFeedProvider(p), false, String(p));
  }
});
