/**
 * Chỗ đặt menu của `Select`, tách riêng để kiểm được bằng số.
 *
 * Nằm ngoài component vì lỗi ở đây KHÔNG nhìn thấy trong tsc hay lint và chỉ
 * lộ ra khi ô chọn tình cờ nằm sát đáy màn — ở form thêm địa điểm thì ô "Đánh
 * giá sao" luôn ở đó.
 */

/** Khe giữa ô chọn và menu. */
export const MENU_GAP = 4;
/** Trần chiều cao menu. */
export const MAX_MENU_HEIGHT = 256;
/** Lề an toàn với mép màn. */
const EDGE = 8;
/**
 * Sàn chiều cao. Bên nào rộng hơn mới được chọn nên sàn này hiếm khi chạm — và
 * khi chạm thì một menu 96px có thanh cuộn vẫn dùng được, còn một menu chạy
 * quá mép màn thì không.
 */
const MIN_MENU_HEIGHT = 96;

export type TriggerRect = { top: number; bottom: number; left: number; width: number };

/**
 * Đúng MỘT trong `top`/`bottom` được đặt.
 *
 * Một hộp `position: fixed` nở XUỐNG từ `top`. Bản trước đặt
 * `top: rect.top - GAP` cho nhánh mở-lên-trên nên hộp vẫn đi xuống: nó phủ kín
 * chính ô vừa bấm rồi chạy quá đáy màn. Đo trên form thêm địa điểm — điện
 * thoại 390×844: tràn 56px, đè 44px lên ô chọn; desktop 1440×900: tràn 52px,
 * đè 44px. Neo bằng `bottom` thì hộp nở lên, đúng chiều còn chỗ trống.
 */
export type MenuPlacement = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  openBelow: boolean;
};

export function menuPlacement(rect: TriggerRect, viewportHeight: number): MenuPlacement {
  const below = viewportHeight - rect.bottom - MENU_GAP - EDGE;
  const above = rect.top - MENU_GAP - EDGE;
  const openBelow = below >= Math.min(MAX_MENU_HEIGHT, 160) || below >= above;
  const maxHeight = Math.min(MAX_MENU_HEIGHT, Math.max(MIN_MENU_HEIGHT, openBelow ? below : above));
  const box = { left: rect.left, width: rect.width, maxHeight, openBelow };
  return openBelow
    ? { ...box, top: rect.bottom + MENU_GAP }
    : { ...box, bottom: viewportHeight - rect.top + MENU_GAP };
}
