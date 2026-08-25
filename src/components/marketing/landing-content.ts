/**
 * Copy for the public landing page.
 *
 * Kept as data (not JSX) because two consumers need the same words: the
 * rendered sections and the JSON-LD block in `app/page.tsx`. Structured data
 * that disagrees with the visible page is a spam signal, so there is exactly
 * one source for both.
 *
 * Every line here describes something the app actually does — the feature list
 * mirrors NAV_ITEMS plus the vault. Marketing claims a crawler can check and
 * find false are worse than no copy at all.
 */

export interface Feature {
  emoji: string;
  title: string;
  body: string;
}

export const FEATURES: Feature[] = [
  {
    emoji: "📅",
    title: "Lịch chung của hai đứa",
    body: "Lên kế hoạch hẹn hò theo ngày, đánh dấu ngày đặc biệt, đếm ngược tới dịp kỷ niệm và ghi rõ ai phụ trách việc gì.",
  },
  {
    emoji: "🗺️",
    title: "Bản đồ nơi đã đi",
    body: "Ghim quán đã ghé và chỗ muốn tới. Muốn rủ nhau đi thì gửi lời mời dẫn đường, người kia thấy ngay trên bản đồ.",
  },
  {
    emoji: "🎡",
    title: "Vòng quay “ăn gì bây giờ”",
    body: "Hết ý tưởng thì để vòng quay chọn: quán đang mở cửa quanh đây, hoặc một món tự nấu trong bộ sưu tập.",
  },
  {
    emoji: "📚",
    title: "Bộ sưu tập công thức & trò chơi",
    body: "Lưu công thức kèm nguyên liệu, các bước và video hướng dẫn. Thêm cả những trò chơi hai người hay bày ra.",
  },
  {
    emoji: "✈️",
    title: "Chuyến đi có lịch trình",
    body: "Dựng lịch trình từng ngày, theo dõi ngân sách và tick dần checklist đồ cần chuẩn bị trước khi lên đường.",
  },
  {
    emoji: "🖼️",
    title: "Dòng kỷ niệm",
    body: "Album theo mốc thời gian, mỗi kỷ niệm tối đa 10 ảnh kèm vài dòng kể lại hôm đó đã vui thế nào.",
  },
  {
    emoji: "🔐",
    title: "Két bí mật",
    body: "Hộp thời gian niêm phong tới đúng ngày mới mở được, wishlist của mỗi người, nhiệm vụ tính điểm và voucher đổi quà cho nhau.",
  },
];

export interface Step {
  number: string;
  title: string;
  body: string;
}

export const STEPS: Step[] = [
  {
    number: "01",
    title: "Tạo tài khoản",
    body: "Đăng nhập bằng Google chỉ với một chạm, hoặc dùng email và mật khẩu nếu bạn thích cách cũ.",
  },
  {
    number: "02",
    title: "Mở không gian riêng",
    body: "Tạo không gian của hai đứa rồi mời người ấy vào. Một không gian chỉ chứa đúng hai người.",
  },
  {
    number: "03",
    title: "Bắt đầu vivu",
    body: "Mọi kế hoạch, tấm ảnh hay ghi chú một người thêm vào đều hiện lên phía người kia gần như tức thì.",
  },
];

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ: FaqItem[] = [
  {
    question: "Vivu No Plan là ứng dụng gì?",
    answer:
      "Là một không gian riêng cho hai người yêu nhau: lịch hẹn hò chung, bản đồ những nơi đã đi, album kỷ niệm, kế hoạch chuyến đi và một chiếc két giữ những điều bí mật. Thay vì để mọi thứ trôi mất trong cuộc trò chuyện, tất cả nằm gọn ở một chỗ.",
  },
  {
    question: "Vivu No Plan có mất phí không?",
    answer:
      "Không. Toàn bộ tính năng hiện có đều dùng miễn phí, không giới hạn thời gian và không cần thẻ thanh toán.",
  },
  {
    question: "Người khác có xem được nội dung của tụi mình không?",
    answer:
      "Không. Mỗi không gian chỉ hai người bên trong mới truy cập được, và mọi yêu cầu dữ liệu đều được kiểm tra quyền ở phía máy chủ chứ không chỉ ẩn đi trên giao diện.",
  },
  {
    question: "Dùng trên điện thoại có được không?",
    answer:
      "Được. Giao diện được dựng theo hướng mobile-first. Bạn có thể thêm Vivu No Plan vào màn hình chính để mở lên như một ứng dụng thật, không còn thanh địa chỉ trình duyệt.",
  },
  {
    question: "Hộp thời gian hoạt động như thế nào?",
    answer:
      "Bạn viết một lá thư rồi chọn ngày mở. Trước ngày đó lá thư vẫn niêm phong với cả hai người — kể cả người vừa viết ra nó. Đến hẹn, chiếc phong bì mới mở ra.",
  },
  {
    question: "Cần bao nhiêu người để bắt đầu?",
    answer:
      "Bạn có thể tạo tài khoản và mở không gian một mình trước, rồi gửi lời mời cho người ấy vào bất cứ lúc nào. Không gian sẽ đợi sẵn.",
  },
];
