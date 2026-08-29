import type { FeaturePage } from "./types";

/**
 * Target intent: "hôm nay ăn gì", "vòng quay chọn món", "không biết ăn gì".
 *
 * The competitive picture shaped this page. That Vietnamese query is owned by
 * single-purpose wheel sites with exact-match domains (vongquaymayman.co,
 * quay.com.vn) and cannot be beaten head-on. But every one of them spins from a
 * list you retype on each visit, which is a real and permanent difference —
 * so that is the argument here, not "our wheel is prettier".
 *
 * On checking claims against the code, and getting it wrong once. An earlier
 * draft of the landing copy promised "quán đang mở cửa quanh đây". A grep for
 * openingHours/openNow found nothing, so the whole phrase was struck as
 * invented — but the fields are named openTime/closeTime, and food-wheel.tsx
 * does filter on them against the current clock, overnight ranges included.
 * Only "quanh đây" was fiction: there is no radius or geolocation anywhere.
 *
 * The grep that mattered did hit. Searching "đang mở" surfaced the wheel's
 * empty state saying no places were open, and that was read as a second lying
 * string rather than as evidence the feature existed. A message someone
 * deliberately wrote is a claim about the code; check why it is there before
 * concluding it is wrong.
 */
export const HOM_NAY_AN_GI: FeaturePage = {
  slug: "hom-nay-an-gi",
  metaTitle: "Hôm nay ăn gì — vòng quay chọn từ quán bạn đã lưu",
  metaDescription:
    "Hết ý tưởng tối nay ăn gì? Vòng quay bốc từ chính những quán bạn đã ghim và bộ công thức của bạn, khỏi gõ lại danh sách mỗi lần. Miễn phí, không cần tải app.",
  h1: "Hôm nay ăn gì?",
  eyebrow: "Vòng quay chọn món",
  tagline:
    "Câu hỏi ngốn nhiều thời gian nhất trong ngày, và thường kết thúc bằng việc ăn lại đúng chỗ hôm qua.",
  art: "wheelFood",
  sections: [
    {
      heading: "Vấn đề không phải là ít chỗ ăn",
      paragraphs: [
        "Bạn có cả một danh sách trong đầu. Quán bún đậu đứa bạn khen tuần trước, chỗ lẩu nhìn thấy lúc đi ngang, quán cà phê ai đó gửi link tháng nào rồi. Đến lúc phải quyết thì không nhớ nổi cái nào, nên lại ra chỗ quen.",
        "Cái mệt không nằm ở chuyện thiếu lựa chọn. Nó nằm ở chỗ phải nhớ ra lựa chọn, đúng vào lúc đang đói và không còn sức nghĩ.",
      ],
    },
    {
      heading: "Mấy cái vòng quay ngoài kia bắt bạn gõ lại từ đầu",
      paragraphs: [
        "Vòng quay random trên mạng thì nhiều. Nhưng mở lên là một vòng quay trống: bạn phải tự gõ tên từng món, từng quán vào, quay xong đóng tab là mất sạch. Lần sau đói lại gõ lại.",
        "Chúng giải quyết việc bốc ngẫu nhiên, chứ không giải quyết việc bạn không nhớ mình đang có những chỗ nào.",
      ],
    },
    {
      heading: "Ở đây vòng quay đọc sẵn danh sách của bạn",
      items: [
        {
          label: "Quán bạn đã ghim",
          body: "Thấy chỗ nào muốn thử thì ghim vào bản đồ, lúc nào rảnh cũng được. Vòng quay bốc từ đúng những chỗ đó — không phải gõ lại, không phải nhớ lại.",
        },
        {
          label: "Món tự nấu",
          body: "Đổi sang tab Tự nấu thì nó quay trong bộ công thức bạn đã lưu, kèm nguyên liệu và video hướng dẫn. Cho những hôm không muốn ra đường.",
        },
        {
          label: "Bỏ sẵn quán đã đóng cửa",
          body: "Khai giờ mở cửa cho quán một lần, từ đó vòng quay tự loại những chỗ giờ này đã đóng — kể cả quán bán xuyên đêm. Bốc ra là đi được luôn, không phải quay lại lần hai vì chỗ đầu đóng rồi.",
        },
        {
          label: "Lọc theo danh mục",
          body: "Chỉ muốn cà phê, hoặc chỉ muốn quán ăn, thì chọn danh mục trước khi quay. Vòng quay sẽ chỉ chứa nhóm đó.",
        },
      ],
    },
    {
      heading: "Quay xong thì rủ luôn",
      // mapIsland here, not wheelFood again: this section is about what
      // happens right after the wheel stops — the map invite — so it earns
      // its own picture instead of repeating the page's masthead art.
      art: "mapIsland",
      paragraphs: [
        "Ra kết quả rồi, nếu có người đi cùng thì gửi lời mời dẫn đường ngay từ đó. Người kia mở bản đồ lên là thấy, khỏi copy địa chỉ dán qua chỗ khác.",
        "Đi một mình thì bấm vào ra bản đồ. Xong.",
      ],
    },
  ],
  faq: [
    {
      question: "Vòng quay lấy quán ở đâu ra?",
      answer:
        "Từ danh sách chỗ bạn đã ghim là muốn tới. Nó không kéo dữ liệu quán từ đâu khác về, nghĩa là kết quả luôn là chỗ bạn thật sự muốn ăn — không phải quán trả tiền để được hiện lên.",
    },
    {
      question: "Chưa ghim quán nào thì sao?",
      answer:
        "Thì vòng quay chưa có gì để bốc. Ghim vài chỗ trên bản đồ trước đã, hoặc chuyển sang tab Tự nấu nếu bạn đã lưu công thức nào rồi.",
    },
    {
      question: "Có lọc được không hay quay hết?",
      answer:
        "Hai lớp. Chọn danh mục trước thì vòng quay chỉ chứa nhóm đó. Và nó tự bỏ ra những quán giờ này đã đóng cửa, tính cả quán mở xuyên đêm kiểu 18h–2h sáng. Quán nào bạn chưa khai giờ thì luôn được giữ lại, vì không có cơ sở để loại.",
    },
  ],
  cta: {
    heading: "Ghim vài chỗ rồi quay thử",
    body: "Miễn phí, chạy thẳng trên trình duyệt, không cần tải app. Ghim ba bốn quán là vòng quay bắt đầu có việc để làm.",
    label: "Mở vòng quay",
  },
  related: [
    {
      href: "/luu-dia-diem-da-di",
      label: "Lưu địa điểm đã đi",
      blurb: "Chỗ nào ghim vào đây thì vòng quay bốc được chỗ đó.",
    },
    {
      href: "/nhat-ky-du-lich",
      label: "Nhật ký du lịch",
      blurb: "Lịch trình, ngân sách, và ảnh sau chuyến đi.",
    },
    {
      href: "/thu-gui-tuong-lai",
      label: "Thư gửi tương lai",
      blurb: "Viết một lá thư, niêm phong tới ngày bạn chọn.",
    },
  ],
};
