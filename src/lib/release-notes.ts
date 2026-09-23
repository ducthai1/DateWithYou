/**
 * Nhật ký phát hành — thứ admin mở ra để biết app đã đi qua những gì.
 *
 * ĐẶT TRONG REPO, không đặt trong database, và đó là chủ ý: một dòng ở đây đi
 * cùng commit làm ra nó, nên không bao giờ có chuyện "đã phát hành nhưng quên
 * ghi" hay "ghi rồi nhưng chưa deploy". Người đọc là admin, không phải lập
 * trình viên — viết cho người đó: chuyện gì đổi và vì sao nó quan trọng, không
 * phải tên hàm nào được sửa.
 *
 * ▸ LUẬT: sửa hay thêm tính năng thì THÊM MỘT MỤC VÀO ĐÂY TRONG CÙNG COMMIT.
 *   Mục mới lên ĐẦU mảng. Mỗi `change`:
 *     - `what`  — một câu, nói theo thứ người dùng thấy
 *     - `why`   — vì sao nó đáng làm, hoặc triệu chứng đã được báo
 *   Không chép nguyên văn commit message, không dán số dòng, không đi sâu vào
 *   code. Nếu một thay đổi không giải thích được bằng một câu cho người không
 *   đọc code, thì nó chưa được hiểu đủ rõ để ghi.
 */

export type ReleaseChange = {
  /** Thấy gì khác đi. Một câu. */
  what: string;
  /** Vì sao làm, hoặc triệu chứng người dùng đã báo. */
  why: string;
  kind: "feature" | "fix" | "speed" | "polish";
};

export type Release = {
  /** Mốc, dạng `YYYY-MM-DD`. Dùng làm đường dẫn luôn. */
  date: string;
  /** Tên gọi ngắn của đợt, hiện ở danh sách ngoài. */
  title: string;
  /** Một câu tóm tắt cả đợt — đây là phần "preview ngắn". */
  summary: string;
  changes: ReleaseChange[];
};

export const RELEASES: Release[] = [
  {
    date: "2026-09-23",
    title: "Dán link bản đồ ra đúng chỗ, và màn khởi động liền một mạch",
    summary:
      "Link Google Maps dán vào giờ ghim đúng quán thay vì lệch hàng chục cây số, và ba màn khởi động khác nhau đã gom về một.",
    changes: [
      {
        kind: "fix",
        what: "Dán link bản đồ vào là ghim đúng quán.",
        why: "Link chia sẻ từ điện thoại không mang sẵn toạ độ, nên hệ thống đi đoán theo tên quán — với một quán ở Ninh Phước, nó đoán ra một chỗ ở Nha Trang cách 76km, nhanh và không có dấu hiệu gì là sai. Hoá ra toạ độ vẫn nằm trong link, dưới một dạng khác, và bị bỏ qua.",
      },
      {
        kind: "fix",
        what: "Không đoán bừa nữa: không chắc thì nói không chắc.",
        why: "Khi không có gì để đối chiếu, mọi kết quả tìm kiếm đều được chấp nhận. Giờ nếu toạ độ trong link mâu thuẫn với mọi kết quả, form sẽ mời chạm chọn trên bản đồ thay vì ghim đại một chỗ.",
      },
      {
        kind: "polish",
        what: "Màn khởi động chạy liền một mạch từ lúc bấm tới lúc vào app.",
        why: "Thực ra có tới ba màn khởi động khác nhau cho cùng một app: màn của hệ điều hành, tấm che của web, và ảnh khởi động của iPhone — dấu hiệu chênh nhau tới 2,5 lần. Nay cả ba cùng một bố cục.",
      },
      {
        kind: "fix",
        what: "Tên app lúc khởi động không còn nhảy khi thanh điều hướng ẩn đi.",
        why: "Chữ được đặt theo khung đang co giãn, nên mỗi lần thanh dưới của máy biến mất là nó tụt xuống theo.",
      },
    ],
  },
  {
    date: "2026-09-20",
    title: "Mở app nhanh hơn, và app biết nói khi mất mạng",
    summary:
      "Bớt những khoảng chờ không cần thiết lúc mở app và chuyển tab, thêm màn báo mất kết nối tử tế, và sửa loạt lỗi giao diện đã được báo.",
    changes: [
      {
        kind: "fix",
        what: "Mất mạng không còn báo “Chưa có kỷ niệm nào” nữa.",
        why: "Năm màn từng rơi xuống trạng thái rỗng khi mất mạng — đọc ra như dữ liệu của hai người đã biến mất, trong khi chỉ là rớt sóng. Giờ chúng nói “không tải được” và có nút thử lại.",
      },
      {
        kind: "feature",
        what: "Có thanh báo mất kết nối cho cả app, và trang riêng thay cho trang lỗi của trình duyệt.",
        why: "Trước đây chỉ màn bản đồ biết mình đang offline; mọi trang khác rơi vào trang “No internet” của Chrome.",
      },
      {
        kind: "speed",
        what: "Mở app và chuyển tab nhanh hơn rõ rệt.",
        why: "Một lần mở màn hình đầu từng hỏi máy chủ bốn lần cùng một câu hỏi, và mỗi lần chuyển tab phải chờ máy chủ lại từ đầu dù vừa ở đó xong.",
      },
      {
        kind: "speed",
        what: "Bản đồ không còn vẽ lại chậm mỗi lần mở.",
        why: "Mỗi lần vào, camera bị ném về một mức phóng cố định rồi chạy thêm một hoạt ảnh 0,7 giây nữa — mọi mảnh bản đồ đã tải đều thành sai mức và phải tải lại.",
      },
      {
        kind: "polish",
        what: "Thẻ ở trang chủ và trang tính năng bấm vào đâu cũng mở.",
        why: "Thẻ sáng lên khi rê chuột nhưng chỉ bấm trúng vài chỗ mới mở được; có thẻ còn sáng lên mà không dẫn đi đâu cả.",
      },
      {
        kind: "polish",
        what: "Chữ và nút màu chủ đạo đã đủ đậm để đọc.",
        why: "Đo lại toàn bộ trang công khai: chữ trắng trên nút chỉ đạt 3,9 lần tương phản, dưới ngưỡng đọc được là 4,5.",
      },
      {
        kind: "fix",
        what: "Đổi biệt danh thì lời nhắc sinh nhật đổi theo ngay.",
        why: "Lịch và màn Hôm nay vẫn gọi tên cũ, kể cả sau khi đã đổi — vì tên được chép vào lúc tạo và không ai sửa lại.",
      },
      {
        kind: "fix",
        what: "Gỡ tấm phủ khởi động vừa thêm — nó làm chậm hẳn thay vì che đi.",
        why: "Đo trên video quay màn hình thật: splash của Android chạy 4,5 giây, rồi giao diện hiện ra, RỒI tấm phủ mới mọc lên và ở lại thêm 6 giây nữa. Nó không nằm trong lần vẽ đầu nên không che được gì, chỉ cộng thêm thời gian chờ.",
      },
      {
        kind: "fix",
        what: "Thêm ảnh khởi động cho iPhone Air và iPad Pro M4.",
        why: "iOS bỏ qua ảnh khởi động nếu kích thước không khớp tuyệt đối, và bỏ qua trong im lặng — nên vài máy không có splash mà không ai biết vì sao.",
      },
    ],
  },
];

/** Tìm một đợt theo ngày, cho trang chi tiết. */
export function releaseByDate(date: string): Release | undefined {
  return RELEASES.find((r) => r.date === date);
}
