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
        kind: "feature",
        what: "Màn khởi động giữ lại cho tới khi màn đầu tiên có gì để xem.",
        why: "Trước đây ảnh khởi động biến mất ngay, để lộ một màn xương xẩu rồi mới tới nội dung.",
      },
    ],
  },
];

/** Tìm một đợt theo ngày, cho trang chi tiết. */
export function releaseByDate(date: string): Release | undefined {
  return RELEASES.find((r) => r.date === date);
}
