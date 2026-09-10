import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "@/lib/slug";

/*
 * Blog URLs. Once a post is indexed, its slug is a promise — Google took four
 * days to find these pages, and changing how a slug is built silently breaks
 * every link that already exists.
 */

test("slugify: tiếng Việt có dấu ra chuỗi thuần a-z0-9 và gạch nối", () => {
  assert.equal(slugify("Hôm nay ăn gì?"), "hom-nay-an-gi");
  assert.equal(slugify("Đi chơi không kế hoạch"), "di-choi-khong-ke-hoach");
  assert.equal(slugify("Bản đồ Việt Nam — Hoàng Sa, Trường Sa"), "ban-do-viet-nam-hoang-sa-truong-sa");
});

test("slugify: gộp mọi thứ không phải chữ số thành một gạch, không để gạch ở hai đầu", () => {
  assert.equal(slugify("  ***Xin  chào!!!  "), "xin-chao");
  assert.equal(slugify("a___b   c"), "a-b-c");
  assert.equal(slugify("---"), "");
});

test("slugify: chặn ở 90 ký tự", () => {
  const long = slugify("a".repeat(200));
  assert.equal(long.length, 90);
  assert.ok(slugify("Rất dài ".repeat(40)).length <= 90);
});

test("slugify: chỉ ra chữ thường, số và gạch nối", () => {
  for (const raw of ["MiXeD CaSe", "Số 123", "Emoji 🎉 ở giữa", "Ð và đ"]) {
    assert.match(slugify(raw), /^[a-z0-9-]*$/, raw);
  }
});
