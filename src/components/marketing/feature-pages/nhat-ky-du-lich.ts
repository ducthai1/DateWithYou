import type { FeaturePage } from "./types";

/**
 * Target intent: "nhật ký du lịch online", "app ghi lại chuyến đi", "lịch
 * trình du lịch", "theo dõi chi phí chuyến đi".
 *
 * Facts checked before writing: trip.ts carries startDate/endDate, a budget
 * field and checklists with an assigneeId and isDone, so "chia việc" is real.
 * plan-item.ts has a date plus an optional tripId and a listByTrip query, which
 * is what makes the per-day itinerary claim true rather than aspirational.
 * memory.ts caps photos at 10 and captions at 1000 characters — the cap is
 * presented here as what it actually is, a forcing function, not hidden.
 */
export const NHAT_KY_DU_LICH: FeaturePage = {
  slug: "nhat-ky-du-lich",
  metaTitle: "Nhật ký du lịch online — lịch trình, ngân sách, ảnh",
  metaDescription:
    "Dựng lịch trình du lịch từng ngày, theo dõi ngân sách và checklist đồ mang đi. Đi xong, ảnh và vài dòng kể lại thành quyển nhật ký bạn không phải ngồi viết.",
  h1: "Chuyến đi nào rồi cũng chỉ còn lại bốn trăm tấm ảnh",
  eyebrow: "Chuyến đi & nhật ký",
  tagline:
    "Không ai mở lại thư mục ảnh chuyến đi năm ngoái. Vì mở ra thì chẳng biết đang xem ngày thứ mấy, ở đâu, đi với ai.",
  sections: [
    {
      heading: "Phần khó không phải là chụp ảnh",
      paragraphs: [
        "Ảnh thì bao giờ cũng đủ, thường là quá đủ. Cái mất đi là mọi thứ quanh tấm ảnh: hôm đó là ngày thứ mấy, quán đó tên gì, sao lại đi đường vòng, ai là người nhất định đòi ghé chỗ kia.",
        "Ai cũng định về nhà rồi viết lại. Gần như không ai viết. Không phải vì lười — vì lúc đó nó thành một bài phải ngồi soạn, mà chẳng ai có hai tiếng rảnh để soạn.",
      ],
    },
    {
      heading: "Trước chuyến đi",
      items: [
        {
          label: "Lịch trình từng ngày",
          body: "Mỗi chuyến có ngày bắt đầu và ngày kết thúc, việc gì gắn vào ngày nào thì nằm ở ngày đó. Mở ra là biết mai đi đâu, không phải đọc lại cả đoạn chat.",
        },
        {
          label: "Ngân sách",
          body: "Đặt một con số cho cả chuyến rồi theo dõi dần. Không phải phần mềm kế toán, chỉ đủ để biết đang tiêu quá hay còn dư.",
        },
        {
          label: "Checklist chia việc",
          body: "Đồ cần mang, ai lo món nào, tick dần cho tới lúc lên đường. Việc gắn tên người nên không còn cảnh hai người cùng mang sạc dự phòng mà quên thuốc.",
        },
      ],
    },
    {
      heading: "Sau chuyến đi, phần không ai làm",
      paragraphs: [
        "Đây là chỗ khác biệt: bạn không viết một bài. Bạn thêm một kỷ niệm, chọn nhiều nhất mười tấm ảnh, và viết vài dòng. Hết.",
        "Mười tấm là cố ý. Bốn trăm tấm thì không ai xem lại, mười tấm thì có. Giới hạn đó buộc bạn phải chọn, và chính lúc chọn là lúc bạn nhớ ra hôm đó có gì đáng nhớ.",
        "Những kỷ niệm đó nằm trên một dòng thời gian. Sang năm mở ra, nó đã tự là quyển nhật ký du lịch mà bạn chưa từng phải ngồi viết.",
      ],
    },
    {
      heading: "Vì sao một app ghi chú không thay được",
      paragraphs: [
        "App ghi chú ghi được mọi thứ, nhưng nó không biết dòng nào là địa điểm, dòng nào là ngày, dòng nào là ảnh. Nên nó không giúp bạn xem lại theo thời gian, và không nối được với chỗ bạn đã ghim trên bản đồ.",
        "Ở đây chuyến đi, lịch, bản đồ và dòng kỷ niệm là cùng một hệ. Quán bạn ghé trong chuyến nằm luôn trên bản đồ của bạn, không phải nhập lại lần nữa.",
      ],
    },
  ],
  faq: [
    {
      question: "Lịch trình chia theo từng ngày được không?",
      answer:
        "Được. Mỗi chuyến có ngày bắt đầu và ngày kết thúc, và mỗi việc trong lịch trình gắn vào một ngày cụ thể, nên xem theo ngày là ra đúng hôm đó có gì.",
    },
    {
      question: "Theo dõi chi phí chuyến đi được không?",
      answer:
        "Có một ngân sách cho mỗi chuyến để bạn đặt số dự kiến và theo dõi. Nói trước cho rõ: nó không chia tiền từng người hay tính ai nợ ai — chỉ là con số cho cả chuyến.",
    },
    {
      question: "Đi xong thì ảnh nằm ở đâu?",
      answer:
        "Trong dòng kỷ niệm, theo mốc thời gian. Mỗi kỷ niệm tối đa mười ảnh kèm vài dòng kể lại, xem lại theo năm tháng chứ không phải cuộn qua một thư mục ảnh không tên.",
    },
  ],
  cta: {
    heading: "Dựng chuyến đi tới",
    body: "Kể cả chuyến đi mới chỉ là ý tưởng thì cũng tạo được, rồi thêm dần. Miễn phí, không cần tải app.",
    label: "Mở phần chuyến đi",
  },
  related: [
    {
      href: "/luu-dia-diem-da-di",
      label: "Lưu địa điểm đã đi",
      blurb: "Quán ghé trong chuyến nằm luôn trên bản đồ của bạn.",
    },
    {
      href: "/hom-nay-an-gi",
      label: "Hôm nay ăn gì",
      blurb: "Vòng quay bốc từ danh sách chỗ muốn tới.",
    },
    {
      href: "/thu-gui-tuong-lai",
      label: "Thư gửi tương lai",
      blurb: "Viết một lá thư, niêm phong tới ngày bạn chọn.",
    },
  ],
};
