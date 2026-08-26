/**
 * Copy for the public landing page.
 *
 * Kept as data (not JSX) because two consumers need the same words: the
 * rendered sections and the JSON-LD block in `app/page.tsx`. Structured data
 * that disagrees with the visible page is a spam signal, so there is exactly
 * one source for both.
 *
 * WHO THIS IS WRITTEN FOR. Earlier drafts said "cặp đôi" and "hai đứa yêu
 * nhau" throughout, which quietly threw away most of the people the product
 * actually serves: the space holds any two people — friends, siblings,
 * flatmates, a parent and a child, travel companions — and works perfectly well
 * with one. Someone arriving alone, or with a friend, read the first line and
 * left. The copy now says "một mình hoặc hai người", which is both wider and
 * true today; couples are still described, just no longer assumed.
 *
 * It stays honest about the limit: a space holds two people, not a family of
 * five, and the FAQ says so plainly rather than letting someone find out by
 * hitting an error.
 *
 * Every line describes something the app actually does — the feature list
 * mirrors NAV_ITEMS plus the vault.
 */

export interface Feature {
  emoji: string;
  title: string;
  body: string;
}

export const FEATURES: Feature[] = [
  {
    emoji: "📅",
    title: "Lịch chung",
    body: "Lên kế hoạch cho từng ngày, đánh dấu ngày quan trọng, đếm ngược tới dịp sắp tới và ghi rõ ai lo việc gì.",
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
    body: "Lưu công thức kèm nguyên liệu, các bước và video hướng dẫn. Thêm cả những trò chơi hay bày ra lúc rảnh.",
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
    body: "Hộp thời gian niêm phong tới đúng ngày mới mở được, wishlist riêng, nhiệm vụ tính điểm và voucher đổi quà.",
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
    body: "Dùng một mình cũng được — không gian là của bạn ngay từ đầu, không cần đợi ai.",
  },
  {
    number: "03",
    title: "Rủ thêm một người, nếu muốn",
    body: "Gửi mã mời cho người bạn muốn chia sẻ cùng. Mọi thứ một người thêm vào sẽ hiện lên phía người kia gần như tức thì.",
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
      "Là một không gian riêng để giữ lại những nơi bạn đã đi, món đã ăn, ngày đã sống — và lên kế hoạch cho lần tới. Lịch chung, bản đồ địa điểm, album kỷ niệm, lịch trình chuyến đi, công thức nấu ăn và một chiếc két giữ những điều bí mật. Thay vì để mọi thứ trôi mất trong tin nhắn, tất cả nằm gọn ở một chỗ. Nhiều người còn gõ tên nó thành Vivu Plan, VivuNoPlan hay “vi vu không cần plan” — cùng một ứng dụng cả.",
  },
  {
    question: "Đi một mình có dùng được không?",
    answer:
      "Được, và không thiếu tính năng nào. Không gian là của bạn ngay khi tạo xong, không cần đợi ai đồng ý. Lưu địa điểm, viết nhật ký chuyến đi, quay vòng chọn quán, cất hộp thời gian cho chính mình — tất cả đều chạy khi chỉ có một người. Khi nào muốn chia sẻ thì gửi mã mời, không muốn thì thôi.",
  },
  {
    question: "Ai thì hợp dùng cái này?",
    answer:
      "Bất kỳ hai người muốn giữ chung một góc riêng: bạn thân, anh chị em, bạn cùng phòng, bạn đồng hành trong chuyến đi, bố mẹ với con, người yêu. Ứng dụng không hỏi bạn là gì của nhau và cũng không cần biết — nó chỉ giữ những gì hai người thêm vào.",
  },
  {
    question: "Rủ được bao nhiêu người vào một không gian?",
    answer:
      "Hiện tại một không gian giữ tối đa hai người, kể cả bạn. Nhóm bạn hay gia đình đông hơn thì chưa dùng chung một không gian được — nói trước để bạn khỏi mất công tạo rồi mới biết. Bạn vẫn có thể mở nhiều không gian khác nhau cho từng người.",
  },
  {
    question: "Vivu No Plan có mất phí không?",
    answer:
      "Không. Toàn bộ tính năng hiện có đều dùng miễn phí, không giới hạn thời gian, không quảng cáo và không cần thẻ thanh toán.",
  },
  {
    question: "Người khác có xem được nội dung của mình không?",
    answer:
      "Không. Mỗi không gian chỉ người bên trong mới truy cập được, và mọi yêu cầu dữ liệu đều được kiểm tra quyền ở phía máy chủ chứ không chỉ ẩn đi trên giao diện. Không có bảng tin, không có người lạ, không có thuật toán gợi ý.",
  },
  {
    question: "Dùng trên điện thoại có được không?",
    answer:
      "Được. Giao diện được dựng theo hướng mobile-first. Bạn có thể thêm Vivu No Plan vào màn hình chính để mở lên như một ứng dụng thật, không còn thanh địa chỉ trình duyệt.",
  },
  {
    question: "Hộp thời gian hoạt động như thế nào?",
    answer:
      "Bạn viết một lá thư rồi chọn ngày mở. Trước ngày đó lá thư vẫn niêm phong — kể cả với người vừa viết ra nó. Đến hẹn, chiếc phong bì mới mở ra.",
  },
];
