import type { FeaturePage } from "./types";

/**
 * Target intent: "app lưu địa điểm đã đi", "ghim quán ăn đã ghé", "bản đồ quán
 * ăn riêng".
 *
 * The head terms here belong to Foody, Lozi and the retailer listicles that
 * review them, and no amount of copy changes that. What none of them do is
 * remember where *you* went and why you liked it — they rank what the crowd
 * thinks. That distinction is the page.
 *
 * Facts checked in location.ts before writing: status is a two-value enum
 * (want_to_go | visited), so the two-list claim is real; district and category
 * filters exist; sendNavInvite and the midpoint lookup exist. Opening hours do
 * exist, as openTime/closeTime per place, and the wheel filters on them — see
 * hom-nay-an-gi.ts, which covers that. They are not sold here because saving a
 * place is not where that pays off.
 */
export const LUU_DIA_DIEM_DA_DI: FeaturePage = {
  slug: "luu-dia-diem-da-di",
  metaTitle: "App lưu địa điểm đã đi — ghim quán ăn, café đã ghé",
  metaDescription:
    "Ghim quán ăn, café đã ghé và chỗ muốn tới trên bản đồ riêng của bạn. Kèm ghi chú món nên gọi, lọc theo quận và danh mục. Miễn phí, không cần tải app.",
  h1: "Cái quán đó tên gì rồi nhỉ?",
  eyebrow: "Bản đồ nơi đã đi",
  tagline:
    "Quán ngon nhất bạn từng ăn có thể đang nằm trong một tấm ảnh chụp màn hình từ tháng ba.",
  sections: [
    {
      heading: "Chỗ nào cũng lưu, nhưng lưu ở mười nơi khác nhau",
      paragraphs: [
        "Một cái ảnh chụp màn hình trong thư viện. Một link ai đó gửi trong nhóm chat, giờ đã trôi qua ba trăm tin nhắn. Một chỗ bấm dấu sao trên bản đồ, nằm lẫn trong danh sách hai trăm mục không có chú thích nào.",
        "Thành ra thông tin thì có đủ, mà lúc cần thì không tìm ra. Cái thiếu không phải là chỗ lưu — cái thiếu là một chỗ duy nhất, và một dòng ghi chú vì sao hồi đó bạn thích nó.",
      ],
    },
    {
      heading: "Bản đồ của riêng bạn, không phải bảng xếp hạng của mọi người",
      paragraphs: [
        "Các app tìm quán làm tốt việc của chúng: cho bạn biết chỗ nào đang được chấm cao. Nhưng đó là ý kiến của vài nghìn người lạ, và nó không biết bạn đã đi đâu, không biết bạn ăn gì ở đó, không biết bạn có định quay lại hay không.",
        "Bản đồ ở đây chỉ có những chỗ bạn tự cho vào. Mỗi chỗ ghi được món nên gọi lần sau, lọc được theo quận và theo danh mục. Không có quán nào được trả tiền để nổi lên trước.",
      ],
    },
    {
      heading: "Hai danh sách, vì chúng thật sự khác nhau",
      items: [
        {
          label: "Đã ghé",
          body: "Nơi bạn đã tới rồi. Đây là phần dùng lâu ngày mới thấy quý: sau một năm, bản đồ này chính là bản ghi bạn đã đi những đâu.",
        },
        {
          label: "Muốn tới",
          body: "Chỗ nghe người ta khen mà chưa đi. Đúng danh sách này là nguồn cho vòng quay chọn quán, nên nó không nằm không — hôm nào bí thì nó tự nhảy ra.",
        },
      ],
    },
    {
      heading: "Đi cùng ai thì bớt được đoạn nhắn “mày tới chưa”",
      paragraphs: [
        "Chọn một chỗ rồi gửi lời mời dẫn đường, người kia mở bản đồ lên là thấy cả hai đang ở đâu trên đường. Không phải chụp màn hình chỉ đường gửi qua.",
        "Hai người xuất phát từ hai đầu thành phố thì có thể tìm điểm hẹn ở khoảng giữa, hoặc dựng lộ trình ghé đón nhau trước khi tới nơi.",
      ],
    },
  ],
  faq: [
    {
      question: "Khác gì lưu địa điểm trên Google Maps?",
      answer:
        "Google Maps tìm chỗ giỏi hơn nhiều, cái đó không phải bàn. Khác nhau là ở phần sau khi tìm: ở đây mỗi chỗ đi kèm ghi chú món nên gọi, tách riêng đã ghé và muốn tới, và nối được với những phần khác — chỗ bạn ghim là nguồn cho vòng quay chọn quán, và ghé quán nào thì viết được vào dòng kỷ niệm hôm đó.",
    },
    {
      question: "Xem lại được mình đã đi những đâu chưa?",
      answer:
        "Được. Lọc theo trạng thái đã ghé là ra toàn bộ, xem trên bản đồ hoặc xem dạng danh sách, lọc thêm theo quận hay danh mục nếu muốn tìm nhanh.",
    },
    {
      question: "Ghim được chỗ chưa đi không?",
      answer:
        "Được, đó là mục đích của danh sách muốn tới. Nghe ai khen chỗ nào thì ghim luôn cho khỏi quên, đi rồi thì đổi sang đã ghé.",
    },
  ],
  cta: {
    heading: "Ghim chỗ đầu tiên",
    body: "Chạm lên bản đồ là thêm được. Không cần tải app, không mất phí, không cần thẻ thanh toán.",
    label: "Mở bản đồ",
  },
  related: [
    {
      href: "/hom-nay-an-gi",
      label: "Hôm nay ăn gì",
      blurb: "Vòng quay bốc từ chính danh sách muốn tới của bạn.",
    },
    {
      href: "/nhat-ky-du-lich",
      label: "Nhật ký du lịch",
      blurb: "Chuyến đi xa thì có lịch trình và ngân sách riêng.",
    },
    {
      href: "/thu-gui-tuong-lai",
      label: "Thư gửi tương lai",
      blurb: "Viết một lá thư, niêm phong tới ngày bạn chọn.",
    },
  ],
};
