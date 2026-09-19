/**
 * Việc đã biết nhưng chưa làm — để admin mở ra là thấy, không phải đi hỏi.
 *
 * Cùng lý do với `release-notes.ts`: để trong repo thì nó đi cùng commit, và
 * khi một việc được làm xong thì dòng của nó bị xoá trong CHÍNH commit ấy.
 * Danh sách nằm trong database sẽ sống lâu hơn sự thật.
 *
 * ▸ LUẬT: phát hiện việc cần làm mà chưa làm ngay thì thêm vào đây. Làm xong
 *   thì xoá dòng đó và thêm một mục vào `RELEASES`.
 */

export type PendingTask = {
  title: string;
  /** Vì sao nó đáng làm, nói theo thứ người dùng gặp. */
  why: string;
  area: "giao diện" | "tốc độ" | "dữ liệu" | "kiểm thử" | "hạ tầng";
  /** cao = người dùng đang gặp; vừa = gây khó chịu; thấp = nợ kỹ thuật. */
  weight: "cao" | "vừa" | "thấp";
};

export const PENDING_TASKS: PendingTask[] = [
  {
    title: "Bài kiểm nút back đỏ chập chờn khoảng 1/3 lần",
    why: "Bài “back đóng trình xem ảnh” lúc xanh lúc đỏ, và đỏ y hệt trên cây chưa sửa gì — nên là một cuộc đua trong chính bài kiểm, không phải lỗi sản phẩm. Nhưng còn để vậy thì cổng kiểm mất tin cậy.",
    area: "kiểm thử",
    weight: "vừa",
  },
  {
    title: "Màn đăng ký không kịp hiện trên máy chậm",
    why: "Bộ kiểm tự động của luồng người mới đỏ từ trước: trang /sign-up qua bốn lần thử vẫn chưa sẵn sàng để bấm. Chưa rõ có ảnh hưởng người thật không.",
    area: "kiểm thử",
    weight: "vừa",
  },
  {
    title: "Tám hộp thoại tự dựng riêng, không dùng chung nền mờ",
    why: "Năm kiểu nền mờ khác nhau, bốn mức xếp lớp, sáu cái không có viền — nên cùng một app mà mỗi hộp thoại tách khỏi nền một kiểu.",
    area: "giao diện",
    weight: "vừa",
  },
  {
    title: "Dữ liệu mẫu của bộ kiểm lịch trình toàn tên đẹp",
    why: "Tên có dấu chồng, emoji ghép hay token dài không dấu cách là thứ làm tràn màn hình; dữ liệu mẫu hiện tại không có ca nào như vậy nên bộ kiểm không bao giờ thấy.",
    area: "kiểm thử",
    weight: "thấp",
  },
  {
    title: "Ảnh nền của mỗi tab là một tệp lớn riêng",
    why: "Chuyển tab là tải hai ảnh mới, và tông sáng/chiều đổi sau khi trang đã hiện nên có thể tải lại lần nữa.",
    area: "tốc độ",
    weight: "vừa",
  },
  {
    title: "Không có bộ nhớ đệm cho dữ liệu giữa hai lần mở app",
    why: "Đóng app rồi mở lại là chạy lại toàn bộ truy vấn từ đầu, dù dữ liệu vừa xem xong vài phút trước.",
    area: "tốc độ",
    weight: "cao",
  },
];
