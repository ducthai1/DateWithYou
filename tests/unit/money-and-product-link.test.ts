/*
 * Money as people type it, and names from shop links.
 *
 * Both feed fields the user sees filled in for them, so a wrong guess is a
 * wrong value they have to notice: an amount off by a factor of ten, or a
 * product name that is really a tracking id.
 */
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { editMoney, formatMoney, parseMoney, shortMoney } from "@/lib/money";
import { looksLikeLink, nameFromProductLink } from "@/lib/product-link";

describe("money", () => {
  test("whatever the separators, the same amount", () => {
    for (const raw of ["500000", "500.000", "500,000 đ", " 500 000 "]) assert.equal(parseMoney(raw), 500000, raw);
  });
  test("empty is 'not given', not zero", () => {
    assert.equal(parseMoney(""), null);
    assert.equal(parseMoney("đ"), null);
    assert.equal(parseMoney("0"), 0);
  });
  test("an absurd paste does not become an unsafe number", () => {
    assert.ok(Number.isSafeInteger(parseMoney("9".repeat(40)) ?? 0));
  });
  test("dotted, and short for chips", () => {
    assert.equal(formatMoney(1234567), "1.234.567");
    assert.equal(formatMoney(999), "999");
    assert.equal(shortMoney(200_000), "200k");
    assert.equal(shortMoney(1_000_000), "1tr");
    assert.equal(shortMoney(1_500_000), "1,5tr");
  });
  test("backspace over a dot takes the digit before it, not nothing", () => {
    // "1.000" with the caret after the dot; Backspace leaves "1000", caret at 1.
    assert.equal(editMoney(1000, "1000", 1, "deleteContentBackward"), 0);
    // "12.500" caret after the dot; Backspace → "12500", caret 2 → drop the "2".
    assert.equal(editMoney(12500, "12500", 2, "deleteContentBackward"), 1500);
  });
  test("delete over a dot takes the digit after it", () => {
    assert.equal(editMoney(1000, "1000", 1, "deleteContentForward"), 100);
  });
  test("an ordinary keystroke is just the new amount", () => {
    assert.equal(editMoney(500, "5.000", 5, "insertText"), 5000);
    assert.equal(editMoney(5000, "500", 3, "deleteContentBackward"), 500);
    assert.equal(editMoney(null, "", 0, "deleteContentBackward"), null);
  });
});

describe("a name from a shop link", () => {
  test("Shopee writes the name into the path", () => {
    assert.equal(
      nameFromProductLink("https://shopee.vn/Gi%C3%A0y-Sneaker-Nam-Tr%E1%BA%AFng-i.88201679.2185432011"),
      "Giày Sneaker Nam Trắng",
    );
    assert.equal(nameFromProductLink("shopee.vn/Nước-hoa-nữ-Chanel-i.1.2?sp_atk=abc"), "Nước hoa nữ Chanel");
  });
  test("a path without Vietnamese marks is not trusted as a name", () => {
    assert.equal(nameFromProductLink("https://www.lazada.vn/products/vay-ngan-dang-om-i2393539185-s1234.html"), null);
    assert.equal(nameFromProductLink("https://tiki.vn/dien-thoai-iphone-15-128gb-p271966186.html"), null);
  });
  test("short links and junk give nothing", () => {
    assert.equal(nameFromProductLink("https://s.shopee.vn/AKVJLWMBsL"), null);
    assert.equal(nameFromProductLink("https://shopee.vn/"), null);
    assert.equal(nameFromProductLink("not a url at all"), null);
    assert.equal(nameFromProductLink("https://x.vn/%E0%A4%A"), null);
  });
  test("a name that runs on is cut at a word", () => {
    const long = "https://shopee.vn/" + encodeURIComponent(Array(30).fill("Áo").join("-")) + "-i.1.2";
    const name = nameFromProductLink(long);
    assert.ok(name && name.length <= 80 && !name.endsWith(" "), String(name));
  });
  test("what counts as a link in the name box", () => {
    for (const s of ["https://shopee.vn/x", "www.tiki.vn", "shopee.vn/abc-i.1.2"]) assert.ok(looksLikeLink(s), s);
    for (const s of ["Nước hoa", "Son 3CE màu đỏ", "", "1.000.000", "Đi.chơi"]) assert.ok(!looksLikeLink(s), s);
  });
});
