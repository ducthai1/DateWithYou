/**
 * Copy for the public landing page.
 *
 * Kept as data (not JSX) because two consumers need the same words: the
 * rendered sections and the JSON-LD block in `app/page.tsx`. Structured data
 * that disagrees with the visible page is a spam signal, so there is exactly
 * one source for both.
 *
 * WHO THIS IS WRITTEN FOR. Earlier drafts said "cặp đôi" and "hai đứa yêu
 * nhau" throughout (quoted here as literal history — do not run a blanket
 * find-and-replace over this comment; one such sweep already rewrote these
 * very words and destroyed the record of what was fixed). That phrasing
 * quietly threw away most of the people the product actually serves: the space
 * holds two people of any sort — and works perfectly well with one. Someone
 * arriving alone, or with a friend, read the first line and left.
 *
 * The first attempt at fixing that over-corrected into "hai người bất kỳ",
 * which is accurate, wider, and reads like a clause in a contract. Nobody
 * recognises themselves in "bất kỳ". So the copy names moments rather than
 * relationships — the friend who texts "ăn gì chưa", the trip from last year —
 * and lets the reader place themselves. Couples are still in there; they are
 * just one of the people being described rather than the only one.
 *
 * A third pass fixed the Vietnamese itself rather than its scope. Phrases a
 * native speaker flagged are gone: 'ngày đã sống' (nobody says this) and the
 * coarse 'đứa ở chung phòng', where the rudeness was 'đứa' — it now reads
 * 'bạn cùng phòng', since the room was never the problem.
 *
 * That pass also translated 'mobile-first' and 'wishlist' into Vietnamese and
 * the owner reversed it: a Vietnamese reader knows both, so spelling them out
 * added length, not clarity. Replace a loanword only when a reader would
 * genuinely have to stop and decode it.
 *
 * NOTE: this comment quotes strings that also appear in the copy below. A
 * blanket find-and-replace over this file has twice landed on these
 * quotations instead of the copy it was aiming at. Edit by line, not phrase.
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
    body: "Ghim quán ăn, café đã ghé và chỗ muốn tới. Muốn rủ nhau đi thì gửi lời mời dẫn đường, người kia thấy ngay trên bản đồ.",
  },
  {
    emoji: "🎡",
    title: "Vòng quay “hôm nay ăn gì”",
    body: "Hết ý tưởng thì để vòng quay chọn giúp: quán ăn đang mở cửa quanh đây, hoặc một món tự nấu trong bộ sưu tập.",
  },
  {
    emoji: "📚",
    title: "Bộ sưu tập công thức & trò chơi",
    body: "Lưu công thức kèm nguyên liệu, các bước và video hướng dẫn. Thêm cả những trò chơi hay bày ra lúc rảnh.",
  },
  {
    emoji: "✈️",
    title: "Chuyến đi có lịch trình",
    body: "Dựng lịch trình du lịch từng ngày, theo dõi ngân sách và tick dần checklist đồ cần mang trước khi lên đường.",
  },
  {
    emoji: "🖼️",
    title: "Dòng kỷ niệm",
    body: "Album theo mốc thời gian như một quyển nhật ký, mỗi kỷ niệm tối đa 10 ảnh kèm vài dòng kể lại hôm đó.",
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
    body: "Gửi mã mời cho người bạn muốn rủ vào cùng. Ai thêm gì vào, phía bên kia thấy gần như ngay — khỏi chụp màn hình gửi qua gửi lại.",
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
      "Là một không gian riêng để giữ lại những chỗ bạn đã đi, món đã ăn, những hôm đáng nhớ — và lên kế hoạch cho lần tới. Đi chơi gần nhà hay du lịch xa ngày cũng ghi lại được, kể cả khi chuyến đi chẳng có plan nào. Lịch chung, bản đồ địa điểm, album kỷ niệm, lịch trình chuyến đi, công thức nấu ăn và một chiếc két giữ những điều bí mật. Thay vì để mọi thứ trôi mất trong tin nhắn, tất cả nằm gọn ở một chỗ. Nhiều người còn gõ tên nó thành Vivu Plan, VivuNoPlan hay “vi vu không cần plan” — cùng một ứng dụng cả.",
  },
  {
    question: "Đi một mình có dùng được không?",
    answer:
      "Được, và không thiếu thứ gì. Góc này là của bạn ngay khi tạo xong, chẳng phải đợi ai gật đầu. Ghim quán vừa tìm ra, viết lại chuyến đi chơi tuần rồi, quay thử vòng chọn món khi không nghĩ ra tối nay ăn gì, viết một lá thư cho chính mình mở vào năm sau — chạy hết. Lúc nào muốn có người cùng thì gửi mã mời, không thì thôi.",
  },
  {
    question: "Vivu No Plan hợp với ai?",
    answer:
      "Ai cũng có một người hay rủ mình đi đâu đó. Đứa bạn thân tuần nào cũng nhắn “ăn gì chưa”, anh chị em trong nhà, bạn cùng phòng, người yêu, hay người đã đi cùng bạn chuyến năm ngoái. Vivu không hỏi hai người là gì của nhau — nó chỉ giữ giùm những chỗ đã ghé và những hôm đáng nhớ.",
  },
  {
    question: "Rủ được bao nhiêu người vào một không gian?",
    answer:
      "Hiện tại một không gian giữ tối đa hai người, kể cả bạn. Nhóm bạn hay gia đình đông hơn thì chưa dùng chung một không gian được — nói trước để bạn khỏi mất công tạo rồi mới biết. Bạn vẫn có thể mở nhiều không gian khác nhau cho từng người.",
  },
  {
    question: "Có phải tải app không?",
    answer:
      "Không. Vivu No Plan chạy thẳng trên trình duyệt, mở link là dùng được ngay — không cần vào App Store hay Google Play, không chiếm dung lượng máy, không phải chờ cập nhật. Muốn nó nằm sẵn như một app thật thì thêm vào màn hình chính là xong.",
  },
  {
    question: "Vivu No Plan khác gì app đếm ngày yêu hay app ghi chú?",
    answer:
      "App đếm ngày làm rất tốt đúng một việc là đếm ngày. App ghi chú thì ghi được mọi thứ nhưng không biết dòng nào là quán bạn đã ghé. Ở đây bản đồ, lịch, album, công thức và vòng quay chọn món nằm cùng một chỗ và nối được với nhau — quán bạn ghim hôm trước chính là thứ vòng quay bốc ra tối nay. Và nó không chỉ dành cho người yêu.",
  },
  {
    question: "Ghi lại chuyến du lịch được không?",
    answer:
      "Được. Mỗi chuyến có lịch trình từng ngày, theo dõi ngân sách và checklist đồ mang đi. Đi xong, ảnh và vài dòng kể lại nằm luôn trong dòng kỷ niệm — thành một quyển nhật ký du lịch mà bạn không phải cố ngồi viết.",
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
      "Bạn viết một lá thư rồi chọn ngày mở. Trước ngày đó lá thư vẫn niêm phong — kể cả với chính người viết. Đúng ngày, thư mới mở ra được.",
  },
];
