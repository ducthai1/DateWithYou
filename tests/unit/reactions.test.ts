import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_REACTION_BAR,
  REACTION_BAR_SIZE,
  REACTION_EMOJIS,
  REACTION_LABEL,
  normaliseReactionBar,
} from "@/lib/reactions";

/*
 * The reaction bar comes out of the database, where anything could be sitting:
 * a row written by an older build, a duplicate, an emoji removed from the set
 * since. It must always hand back exactly six known emoji, or the bar renders
 * short, twice, or with a hole in it.
 */

test("mỗi emoji trong bộ đều có nhãn tiếng Việt", () => {
  for (const e of REACTION_EMOJIS) {
    assert.equal(typeof REACTION_LABEL[e], "string", e);
    assert.ok(REACTION_LABEL[e].length > 0, e);
  }
});

test("thanh mặc định đúng số ô và lấy từ đầu bộ", () => {
  assert.equal(DEFAULT_REACTION_BAR.length, REACTION_BAR_SIZE);
  assert.deepEqual(DEFAULT_REACTION_BAR, REACTION_EMOJIS.slice(0, REACTION_BAR_SIZE));
});

test("normaliseReactionBar: luôn trả đủ sáu ô, dù đưa vào gì", () => {
  for (const raw of [undefined, null, [], "không phải mảng", 42, [{}], ["🍕", "không-phải-emoji"]]) {
    const out = normaliseReactionBar(raw);
    assert.equal(out.length, REACTION_BAR_SIZE, JSON.stringify(raw));
    for (const e of out) assert.ok((REACTION_EMOJIS as readonly string[]).includes(e), e);
  }
});

test("normaliseReactionBar: giữ đúng thứ tự người dùng chọn, rồi bù cho đủ", () => {
  const out = normaliseReactionBar(["🥳", "🍀"]);
  assert.equal(out[0], "🥳");
  assert.equal(out[1], "🍀");
  assert.equal(out.length, REACTION_BAR_SIZE);
});

test("normaliseReactionBar: bỏ trùng, bỏ emoji lạ, cắt phần thừa", () => {
  assert.deepEqual(normaliseReactionBar(["❤️", "❤️", "😂"]).slice(0, 2), ["❤️", "😂"]);
  const many = normaliseReactionBar([...REACTION_EMOJIS]);
  assert.equal(many.length, REACTION_BAR_SIZE);
  assert.equal(new Set(many).size, REACTION_BAR_SIZE, "không được có ô trùng");
});
