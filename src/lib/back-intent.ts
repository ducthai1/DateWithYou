/*
 * Bấm nút back thì nên làm gì — tách riêng khỏi chỗ thực sự làm.
 *
 * Phần gắn `popstate`, đẩy mốc lịch sử và gọi `history.go` không kiểm bằng
 * unit test được. Phần QUYẾT ĐỊNH thì được, và nó mới là chỗ dễ sai: ranh giới
 * "hai lần liên tiếp", và thứ tự ưu tiên giữa "đóng ảnh" với "thoát app".
 */

/** Hai lần bấm cách nhau trong khoảng này thì tính là bấm liên tiếp. */
export const DOUBLE_BACK_MS = 1200;

export type BackIntent =
  /** Đang xem ảnh toàn màn hình: chỉ đóng ảnh, không rời trang. */
  | "close-photo"
  /** Bấm lần thứ hai ngay sau lần đầu: ra khỏi app. */
  | "exit"
  /**
   * Không có gì để đóng và không phải nhịp thứ hai: để trang lùi như thường.
   *
   * Cố ý KHÔNG hiện lời nhắc "bấm lần nữa để thoát" như app native hay làm.
   * Trên web mình chỉ nghe được `popstate` SAU khi trình duyệt đã lùi, không
   * chặn trước được — nên lời nhắc đó sẽ hiện trên trang đang rời đi. Đo thật
   * bằng e2e: toast không kịp thấy. App native chặn được vì nó sở hữu sự
   * kiện; ở đây thì không, nên thà im còn hơn nhấp nháy một câu vô nghĩa.
   */
  | "navigate";

export function backIntent({
  photoViewerOpen,
  lastBackAt,
  now,
}: {
  photoViewerOpen: boolean;
  /** Mốc của lần back trước, hoặc 0 nếu chưa có / đã bị xoá. */
  lastBackAt: number;
  now: number;
}): BackIntent {
  /*
   * Ảnh được xét TRƯỚC.
   *
   * Người ta vuốt xem ảnh rất nhanh, nên hai cú back sát nhau trong lúc xem là
   * chuyện bình thường — và nếu xét "hai lần liên tiếp" trước thì cú thứ hai
   * sẽ đá họ ra khỏi app trong khi họ chỉ định đóng cái ảnh.
   */
  if (photoViewerOpen) return "close-photo";
  if (lastBackAt > 0 && now - lastBackAt < DOUBLE_BACK_MS) return "exit";
  return "navigate";
}

/**
 * Lùi bao nhiêu nấc thì ra khỏi app.
 *
 * `history.length` là con số duy nhất trình duyệt cho đọc, và nó KHÔNG giảm
 * khi pop — nên đây là ước lượng thừa. Thừa thì cùng lắm lùi quá một nấc, mà
 * quá nấc đầu tiên nghĩa là đã ra khỏi app, đúng cái đang cần. Thiếu mới hỏng,
 * nên luôn cộng thêm một.
 */
export function stepsToLeaveApp(historyLength: number, lengthAtStart: number): number {
  return Math.max(0, historyLength - lengthAtStart) + 1;
}
