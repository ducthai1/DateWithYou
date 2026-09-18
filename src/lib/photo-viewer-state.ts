/*
 * Trình xem ảnh toàn màn hình đang mở hay không — một biến, đọc được ở mọi nơi.
 *
 * `PhotoProvider` của react-photo-view không cho đóng bằng lệnh, và nó nằm ở
 * gốc cây (`providers.tsx`) nên nó sống sót qua mọi lần đổi route. Hai chỗ cần
 * biết nó đang mở: phần chặn nút back (để đóng ảnh thay vì rời trang), và
 * Modal (để không trả lời phím Escape mà đáng ra là của cái ảnh).
 *
 * Cố ý là biến module chứ không phải React context: cả hai chỗ đọc nó bên
 * trong một trình xử lý sự kiện, tại thời điểm sự kiện xảy ra — không phải khi
 * render. Context sẽ kéo theo một lần render lại cho mỗi lần mở ảnh mà chẳng
 * để làm gì.
 */

let open = false;

export function setPhotoViewerOpen(next: boolean): void {
  open = next;
}

export function isPhotoViewerOpen(): boolean {
  return open;
}

/**
 * Đóng trình xem ảnh đang mở. Trả về true nếu thật sự có cái để đóng.
 *
 * Thư viện gắn listener bằng `window.addEventListener("keydown", …)`, nên một
 * sự kiện bắn thẳng vào `window` tới được nó. Và chỉ nó: Modal nghe trên
 * `document`, mà `document` KHÔNG nằm trên đường đi của sự kiện bắn vào
 * `window` — nên bấm back trong lúc xem ảnh không đóng luôn cả kỷ niệm đang
 * mở phía sau. (Modal vẫn tự gác thêm một lần bằng `isPhotoViewerOpen`, để
 * nếu sau này ai đó đổi chỗ nghe thì hỏng có tiếng, không hỏng âm thầm.)
 */
export function closePhotoViewer(): boolean {
  if (!open) return false;
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: false }));
  return true;
}
