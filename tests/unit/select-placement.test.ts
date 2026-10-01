import assert from "node:assert/strict";
import test from "node:test";

import { menuPlacement, MENU_GAP, MAX_MENU_HEIGHT } from "@/components/ui/select-placement";

/*
 * Số đo thật, từ form "Thêm địa điểm" — ô "Đánh giá sao" là ô cuối, nên nó
 * luôn nằm sát đáy và luôn phải mở lên trên.
 */
const SAO_DIEN_THOAI = { rect: { top: 661, bottom: 705, left: 16, width: 358 }, vh: 844 };
const SAO_DESKTOP = { rect: { top: 713, bottom: 757, left: 541, width: 358 }, vh: 900 };
/** Ô "Danh mục" nằm trên đầu form — thừa chỗ phía dưới. */
const DANH_MUC = { rect: { top: 293, bottom: 337, left: 16, width: 358 }, vh: 844 };

/** Mép dưới thật của menu, dù nó được neo bằng `top` hay `bottom`. */
function box(p: ReturnType<typeof menuPlacement>, vh: number) {
  const top = p.top ?? vh - p.bottom! - p.maxHeight;
  return { top, bottom: top + p.maxHeight };
}

test("ô sát đáy: menu mở LÊN, neo bằng bottom chứ không phải top", () => {
  for (const [ten, c] of [["điện thoại", SAO_DIEN_THOAI], ["desktop", SAO_DESKTOP]] as const) {
    const p = menuPlacement(c.rect, c.vh);
    assert.equal(p.openBelow, false, `${ten}: phải chọn mở lên`);
    assert.equal(p.top, undefined, `${ten}: neo bằng top thì hộp nở xuống, phủ kín ô vừa bấm`);
    assert.equal(p.bottom, c.vh - c.rect.top + MENU_GAP, `${ten}: mép dưới menu phải cách ô ${MENU_GAP}px`);
  }
});

test("không tràn khỏi màn, không đè lên ô chọn", () => {
  /*
   * Đây là hai con số người dùng nhìn thấy. Trước khi sửa, đo được: điện thoại
   * tràn 56px và đè 44px; desktop tràn 52px, đè 44px — tức ô chọn bị che kín.
   */
  for (const [ten, c] of [
    ["sao / điện thoại", SAO_DIEN_THOAI],
    ["sao / desktop", SAO_DESKTOP],
    ["danh mục / điện thoại", DANH_MUC],
  ] as const) {
    const p = menuPlacement(c.rect, c.vh);
    const b = box(p, c.vh);
    assert.ok(b.bottom <= c.vh, `${ten}: tràn ${Math.round(b.bottom - c.vh)}px khỏi màn`);
    assert.ok(b.top >= 0, `${ten}: tràn ${Math.round(-b.top)}px phía trên`);
    const chong = Math.min(b.bottom, c.rect.bottom) - Math.max(b.top, c.rect.top);
    assert.ok(chong <= 0, `${ten}: đè ${Math.round(chong)}px lên chính ô chọn`);
  }
});

test("ô trên đầu form: menu mở XUỐNG, cách ô đúng một khe", () => {
  const p = menuPlacement(DANH_MUC.rect, DANH_MUC.vh);
  assert.equal(p.openBelow, true);
  assert.equal(p.top, DANH_MUC.rect.bottom + MENU_GAP);
  assert.equal(p.bottom, undefined);
});

test("chọn bên nào còn nhiều chỗ hơn", () => {
  // Ô ở giữa, dưới rộng hơn.
  assert.equal(menuPlacement({ top: 300, bottom: 344, left: 0, width: 200 }, 900).openBelow, true);
  // Ô ở giữa, trên rộng hơn và dưới không đủ cho một menu tử tế.
  assert.equal(menuPlacement({ top: 700, bottom: 744, left: 0, width: 200 }, 844).openBelow, false);
});

test("chiều cao bị kẹp bởi chỗ trống, không phải bởi số mục", () => {
  // Thừa chỗ: đụng trần.
  assert.equal(menuPlacement({ top: 100, bottom: 144, left: 0, width: 200 }, 1200).maxHeight, MAX_MENU_HEIGHT);
  // Chật: lấy đúng chỗ còn lại, không hơn.
  const chat = menuPlacement({ top: 500, bottom: 544, left: 0, width: 200 }, 700);
  assert.ok(chat.maxHeight <= 500 - MENU_GAP - 8, `kẹp sai: ${chat.maxHeight}`);
});
