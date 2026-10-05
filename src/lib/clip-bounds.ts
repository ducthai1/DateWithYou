/**
 * Khung mà một lớp nổi (`absolute`) THỰC SỰ hiện được bên trong.
 *
 * Không phải khung nhìn: bất kỳ tổ tiên nào có `overflow` khác `visible` đều
 * cắt nó. Đã trả giá hai lần ở cùng một màn — modal kỷ niệm có phần cuộn riêng
 * ngay trên chân modal:
 *
 *   • danh sách gợi ý tag tên mở xuống và bị chân modal đè 77px trên 98px;
 *   • bảng cảm xúc dưới một bình luận cấp 3 tràn 19px qua mép phải.
 *
 * Cả hai đều "hiện" theo mọi phép kiểm DOM, nên chỉ đo hình học mới thấy.
 *
 * Thanh điều hướng cố định không nằm trong luồng DOM nên phải trừ tay —
 * `--nav-dock-h` là chiều cao của nó.
 */
export type ClipBounds = { top: number; bottom: number; left: number; right: number };

export function clipBoundsFor(el: Element): ClipBounds {
  const dock =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-dock-h")) || 0;
  const bounds: ClipBounds = {
    top: 0,
    bottom: window.innerHeight - dock,
    left: 0,
    right: window.innerWidth,
  };
  for (let node = el.parentElement; node; node = node.parentElement) {
    const cs = getComputedStyle(node);
    const clips =
      cs.overflow !== "visible" || cs.overflowY !== "visible" || cs.overflowX !== "visible";
    if (!clips) continue;
    const r = node.getBoundingClientRect();
    // Phần tử đang ẩn (0×0) không cắt gì cả — tính vào là khung rỗng.
    if (r.height === 0 || r.width === 0) continue;
    bounds.top = Math.max(bounds.top, r.top);
    bounds.bottom = Math.min(bounds.bottom, r.bottom);
    bounds.left = Math.max(bounds.left, r.left);
    bounds.right = Math.min(bounds.right, r.right);
  }
  return bounds;
}

/**
 * Cần đẩy ngang bao nhiêu để một hộp nằm gọn trong khung.
 *
 * Âm là đẩy sang trái. Ưu tiên mép trái khi hộp rộng hơn cả khung: thà thò ra
 * bên phải còn hơn mất phần đầu, vì người ta đọc từ trái.
 */
export function shiftIntoBounds(
  box: { left: number; right: number },
  bounds: ClipBounds,
  gutter = 8,
): number {
  const overRight = box.right - (bounds.right - gutter);
  const overLeft = bounds.left + gutter - box.left;
  if (overRight > 0 && overLeft > 0) return 0;
  if (overRight > 0) return -overRight;
  if (overLeft > 0) return overLeft;
  return 0;
}
