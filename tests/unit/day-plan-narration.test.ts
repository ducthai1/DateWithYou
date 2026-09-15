/*
 * The gate between a model's words and the app's facts.
 *
 * A language model is allowed to make the plan read nicely and nothing else.
 * It never chooses a place, and nothing it writes may become a fact — because
 * the four things it would be most tempted to add (a time, a price, a
 * distance, an address) are exactly the four that send somebody to a locked
 * door or leave them short of cash.
 *
 * So the interesting tests here are all refusals. Accepting good output is one
 * test; the rest are the ways an answer has to be thrown away.
 */
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildNarrationPrompt,
  parseNarration,
  type NarrationFact,
} from "../../src/lib/day-plan-narration.ts";

const FACTS: NarrationFact[] = [
  { title: "Cà phê Vợt", kind: "cafe", reason: "Chỗ hai người lưu mà chưa ghé lần nào." },
  { title: "Quán Nướng Lá Chuối", kind: "meal", reason: "Bạn chấm 5 sao cho chỗ này." },
];

const answer = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    dayName: "Chiều lười",
    whys: ["Ngồi đây ngắm phố một lúc đã.", "Ăn tối ở chỗ bạn thích nhất."],
    ...over,
  });

describe("what the model is told", () => {
  test("the prompt carries the facts, and forbids the four claims", () => {
    const p = buildNarrationPrompt(FACTS, "lười");
    assert.match(p, /Cà phê Vợt/);
    assert.match(p, /Quán Nướng Lá Chuối/);
    assert.match(p, /KHÔNG đổi tên quán/);
    assert.match(p, /KHÔNG nhắc giờ mở cửa, giá tiền, địa chỉ hay khoảng cách/);
    assert.match(p, /lười/);
  });

  test("no vibe means no empty line pretending to be one", () => {
    const p = buildNarrationPrompt(FACTS, null);
    assert.ok(!/Tâm trạng hôm nay:\s*$/m.test(p));
  });
});

describe("a good answer", () => {
  test("is accepted, trimmed, in order", () => {
    const out = parseNarration(answer(), FACTS);
    assert.equal(out.ok, true);
    if (!out.ok) return;
    assert.equal(out.value.dayName, "Chiều lười");
    assert.equal(out.value.whys.length, 2);
  });

  test("a fenced code block is still a good answer", () => {
    // Every model does this, and failing over punctuation would throw away
    // answers that are otherwise fine.
    const out = parseNarration("```json\n" + answer() + "\n```", FACTS);
    assert.equal(out.ok, true);
  });

  test("it may quote a place that IS on the plan", () => {
    const out = parseNarration(
      answer({ whys: ['Bắt đầu ở "Cà phê Vợt" cho nhẹ nhàng.', "Rồi ăn tối."] }),
      FACTS,
    );
    assert.equal(out.ok, true);
  });
});

describe("answers that have to be thrown away", () => {
  const reject = (raw: string, reason: string) => {
    const out = parseNarration(raw, FACTS);
    assert.equal(out.ok, false, `expected a refusal for: ${raw.slice(0, 60)}`);
    if (out.ok) return;
    assert.equal(out.reason, reason);
  };

  test("a place nobody put on the plan", () => {
    /*
     * The one that matters most. A model that recommends somewhere the app
     * never chose is recommending somewhere that may not exist, may be closed
     * for good, or may be in another city — and it would arrive looking
     * exactly as trustworthy as the real stops.
     *
     * The whole answer goes, not the one line: a model that invented once has
     * not earned the benefit of the doubt on the rest of it.
     */
    reject(answer({ whys: ['Ghé "Quán Ốc Cô Ba" trước đã.', "Rồi ăn tối."] }), "invented-place");
  });

  test("an invented place hidden in the day's name", () => {
    reject(answer({ dayName: 'Chiều lười ở "Quán Ốc Cô Ba"' }), "invented-place");
  });

  test("a claim about opening hours", () => {
    reject(answer({ whys: ["Mở tới 22h nên cứ thong thả.", "Ăn tối."] }), "forbidden-claim");
    reject(answer({ whys: ["Ghé lúc 7 giờ là đẹp.", "Ăn tối."] }), "forbidden-claim");
  });

  test("a claim about money", () => {
    reject(answer({ whys: ["Cà phê ở đây tầm 50k thôi.", "Ăn tối."] }), "forbidden-claim");
    reject(answer({ whys: ["Giá 120.000đ một người.", "Ăn tối."] }), "forbidden-claim");
  });

  test("a claim about distance", () => {
    reject(answer({ whys: ["Cách đó 300m thôi.", "Ăn tối."] }), "forbidden-claim");
    reject(answer({ whys: ["Đi 2.5km là tới.", "Ăn tối."] }), "forbidden-claim");
  });

  test("a claim about an address", () => {
    reject(answer({ whys: ["Nằm ở đường 3 Tháng 2.", "Ăn tối."] }), "forbidden-claim");
  });

  test("the wrong number of sentences", () => {
    // Off by one and every stop after it gets somebody else's sentence.
    reject(answer({ whys: ["Chỉ một câu."] }), "count-mismatch");
  });

  test("not JSON at all", () => {
    reject("Chào bạn! Đây là kế hoạch của bạn nhé:", "not-json");
  });

  test("JSON of the wrong shape", () => {
    reject(JSON.stringify({ text: "xin chào" }), "wrong-shape");
    reject(JSON.stringify({ dayName: "x", whys: "không phải mảng" }), "wrong-shape");
  });

  test("a sentence long enough to break the card", () => {
    reject(answer({ whys: ["a".repeat(200), "Ăn tối."] }), "too-long");
  });

  test("an empty sentence", () => {
    reject(answer({ whys: ["   ", "Ăn tối."] }), "too-long");
  });
});
