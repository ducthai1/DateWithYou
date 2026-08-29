import type { FeaturePage } from "./types";

/**
 * Target intent: "viết thư gửi tương lai", "hộp thời gian online", "thư gửi
 * cho chính mình".
 *
 * Three facts checked in capsule.ts, and all three shaped the copy rather than
 * being written around:
 *
 *  - The seal is real. `list` strips message and mediaUrls server-side while
 *    locked, with an explicit SECURITY comment, so the content never reaches
 *    the browser at all. That is worth claiming precisely because it is true;
 *    an app that merely hides the text in the UI could not honestly say it.
 *  - There are exactly three procedures: list, create, markOpened. No update,
 *    no delete. A written capsule cannot be edited or removed, which the FAQ
 *    states plainly — someone deciding whether to write something heavy needs
 *    to know that before they write it, not after.
 *  - There is no recipient field. Capsules belong to the space, so if a second
 *    member exists they will read it too. Left unsaid, a reader could assume a
 *    privacy that does not exist.
 */
export const THU_GUI_TUONG_LAI: FeaturePage = {
  slug: "thu-gui-tuong-lai",
  metaTitle: "Viết thư gửi tương lai — hộp thời gian niêm phong",
  metaDescription:
    "Viết một lá thư, chọn ngày mở, rồi để nó ngủ. Trước ngày đó không ai đọc được, kể cả người vừa viết — nội dung bị giữ lại ở phía máy chủ.",
  h1: "Có những điều hôm nay chưa nói được",
  eyebrow: "Hộp thời gian",
  tagline:
    "Viết ra, chọn một ngày, rồi để đó. Đến hẹn nó mới mở — và đó là toàn bộ ý nghĩa của nó.",
  art: "vaultSafe",
  sections: [
    {
      heading: "Niêm phong thì phải là niêm phong thật",
      paragraphs: [
        "Một ghi chú bạn mở lại lúc nào cũng được thì chỉ là ghi chú. Nó không tạo ra cái cảm giác của một lá thư đợi tới ngày, vì bạn biết mình xem trước được, và rồi bạn sẽ xem trước.",
        "Ở đây trước ngày mở, nội dung lá thư không hề được gửi về máy bạn. Máy chủ giữ lại — nên không phải chuyện giao diện ẩn đi, mà là thứ đó không có ở phía bạn để mà xem. Kể cả bạn là người viết ra nó.",
        "Đến ngày, phong bì mới mở. Không sớm hơn được, dù có muốn.",
      ],
    },
    {
      heading: "Người ta thường viết gì vào đó",
      items: [
        {
          label: "Cho sinh nhật sang năm",
          body: "Viết trước một lá, đặt ngày mở là sinh nhật. Đến hôm đó nó tự có mặt, đúng lúc bạn đã kịp quên là mình từng viết.",
        },
        {
          label: "Câu chưa dám nói bây giờ",
          body: "Có những điều nói hôm nay thì nặng quá, mà không nói ra thì cứ nằm đó. Viết vào một lá thư mở sau ba tháng là một cách để nó không mất, cũng không phải nói ngay.",
        },
        {
          label: "Dự đoán một năm nữa",
          body: "Đoán xem sang năm mình đang làm gì, ở đâu, đã đi được những đâu. Mở ra đọc lại thường là phần vui nhất.",
        },
        {
          label: "Lời nhắn cho chính mình lúc mệt",
          body: "Viết lúc đang ổn, để dành cho lúc không ổn. Chọn một ngày xa xa, rồi quên nó đi.",
        },
      ],
    },
    {
      heading: "Két bí mật còn gì nữa",
      paragraphs: [
        "Hộp thời gian nằm trong phần két, cùng với vài thứ khác cho những việc chưa muốn nói ra vội: một wishlist riêng để ghi điều mình muốn có, nhiệm vụ tính điểm, và voucher đổi quà tự đặt ra với nhau.",
        "Tất cả nằm sau cùng một cánh cửa, tách khỏi phần lịch và bản đồ dùng hằng ngày.",
      ],
    },
  ],
  faq: [
    {
      question: "Trước ngày mở có ai đọc được không?",
      answer:
        "Không, và không phải kiểu giao diện ẩn đi. Khi thư còn khoá, máy chủ không gửi nội dung về máy bạn — mở công cụ dành cho nhà phát triển ra xem cũng không có gì để xem. Người viết cũng không đọc lại được trước hạn.",
    },
    {
      question: "Viết rồi sửa hay xoá được không?",
      answer:
        "Không. Viết xong là niêm phong luôn, hiện chưa sửa được cũng chưa xoá được. Nói trước để bạn cân nhắc xong hãy bấm lưu, nhất là với những lá thư nặng.",
    },
    {
      question: "Nếu có người thứ hai trong không gian thì họ đọc được không?",
      answer:
        "Đến ngày mở thì có. Thư thuộc về không gian chứ chưa gửi riêng cho một người được, và thư ai viết thì có ghi rõ. Nếu bạn muốn viết cho riêng mình đọc thì dùng một không gian chỉ có bạn.",
    },
  ],
  cta: {
    heading: "Viết lá đầu tiên",
    body: "Chọn một ngày trong tương lai, viết vài dòng, rồi để đó. Miễn phí, không cần tải app.",
    label: "Mở két bí mật",
  },
  related: [
    {
      href: "/nhat-ky-du-lich",
      label: "Nhật ký du lịch",
      blurb: "Lịch trình, ngân sách, và ảnh sau chuyến đi.",
    },
    {
      href: "/luu-dia-diem-da-di",
      label: "Lưu địa điểm đã đi",
      blurb: "Bản đồ những chỗ bạn đã ghé và muốn tới.",
    },
    {
      href: "/hom-nay-an-gi",
      label: "Hôm nay ăn gì",
      blurb: "Vòng quay bốc từ danh sách chỗ muốn tới.",
    },
  ],
};
