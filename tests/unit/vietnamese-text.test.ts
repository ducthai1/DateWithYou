import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPattern, foldForSearch, toBaseLetters } from "@/lib/vietnamese-text";

/*
 * Typing without accents has to find text written with them.
 *
 * This is the search feature people actually use — nobody reaches for the
 * accent keys to look up a café they saved last month — and it fails silently:
 * a broken fold returns an empty result set, which reads as "chưa lưu gì" and
 * not as a bug.
 */

test("toBaseLetters: bỏ dấu, và đ thành d ở cả hai kiểu chữ", () => {
  assert.equal(toBaseLetters("Tiếng Việt"), "Tieng Viet");
  assert.equal(toBaseLetters("Đà Nẵng"), "da Nang");
  assert.equal(toBaseLetters("cà phê sữa đá"), "ca phe sua da");
  assert.equal(toBaseLetters("ẨN Ữ Ợ"), "AN U O");
  assert.equal(toBaseLetters("không dấu"), "khong dau");
});

test("foldForSearch: hạ chữ thường, gộp khoảng trắng, cắt hai đầu", () => {
  assert.equal(foldForSearch("  Cà   PHÊ  "), "ca phe");
  assert.equal(foldForSearch("Bún\tBò\nHuế"), "bun bo hue");
  assert.equal(foldForSearch(""), "");
});

test("buildPattern: gõ không dấu vẫn khớp chữ có dấu", () => {
  const pattern = buildPattern("ca phe");
  assert.ok(pattern, "phải dựng được mẫu");
  const re = new RegExp(pattern!, "i");
  for (const hit of ["cà phê", "Cà Phê Sữa", "ca phe", "CÀ  PHÊ"]) {
    assert.ok(re.test(hit), `phải khớp "${hit}"`);
  }
  assert.equal(re.test("cà pho"), false, "không được khớp bừa");
});

test("buildPattern: gõ CÓ dấu cũng vẫn khớp", () => {
  const re = new RegExp(buildPattern("cà phê")!, "i");
  assert.ok(re.test("ca phe"));
  assert.ok(re.test("cà phê"));
});

test("buildPattern: khoảng trắng thành \\s+, không bao giờ đứng ở đầu mẫu", () => {
  const p = buildPattern("  bun   bo  ");
  assert.ok(p, "vẫn phải ra mẫu");
  assert.equal(p!.startsWith("\\s+"), false, `mẫu không được mở đầu bằng \\s+: ${p}`);
  assert.ok(new RegExp(p!, "i").test("Bún   Bò"));
});

test("buildPattern: chuỗi rỗng hoặc chỉ khoảng trắng thì trả null", () => {
  for (const raw of ["", "   ", "\t\n"]) assert.equal(buildPattern(raw), null, JSON.stringify(raw));
});

test("buildPattern: ký tự đặc biệt của regex bị vô hiệu, không làm nổ mẫu", () => {
  const p = buildPattern("c+a (b)");
  assert.ok(p, "phải ra mẫu");
  assert.doesNotThrow(() => new RegExp(p!, "i"), "mẫu phải hợp lệ");
  assert.ok(new RegExp(p!, "i").test("c+a (b)"));
});
