import type { FeaturePage } from "./types";

/**
 * Target intent: "đi chơi không kế hoạch", "du lịch không kế hoạch", "đi chơi
 * không plan", "đi chơi ngẫu hứng", "du lịch tự phát".
 *
 * The competitive picture. Every result for these queries is an itinerary:
 * blogs, OTA landing pages, "cẩm nang 3 ngày 2 đêm". They compete on having
 * more plans, which is the opposite of what the person typing this wants — and
 * it is a fight this site cannot win anyway, having neither their content
 * volume nor their domains. What none of them offers is the thing that actually
 * goes wrong when you leave without a plan: nothing gets written down. So this
 * page argues about the record, not about destinations.
 *
 * Claims checked against the code before writing. `LocationModel.status` is an
 * enum of exactly `want_to_go` and `visited`, so "danh sách chỗ muốn tới" is
 * real. Trips do carry a per-day itinerary, a budget and a checklist, which is
 * why the last section admits the app plans as well — pretending otherwise
 * would be a lie a reader catches in one click. There is no radius, no
 * geolocation and no database of suggestions anywhere: the FAQ says so outright
 * rather than letting a reader assume it.
 */
export const DI_CHOI_KHONG_KE_HOACH: FeaturePage = {
  slug: "di-choi-khong-ke-hoach",
  metaTitle: "Đi chơi không kế hoạch — cách đi mà vẫn giữ lại được",
  metaDescription:
    "Đi chơi không plan thì vui, nhưng thường chẳng còn lại gì ngoài mấy trăm tấm ảnh. Ghim sẵn chỗ muốn tới, quyết vào đúng hôm đi, và chuyến đi tự được ghi lại. Miễn phí, chạy trên trình duyệt.",
  h1: "Đi chơi không kế hoạch",
  eyebrow: "Không cần plan",
  tagline:
    "Không phải ai cũng muốn lên lịch trình ba ngày hai đêm. Nhưng chuyến đi nào rồi cũng đáng được nhớ lại.",
  art: "tripPlanner",
  sections: [
    {
      heading: "Không có kế hoạch khác với chưa chuẩn bị gì",
      paragraphs: [
        "Người đi không kế hoạch không phải người không biết mình thích gì. Ngược lại: trong đầu có sẵn một danh sách dài những chỗ đã thấy ai đó nhắc, những quán đi ngang thấy đông, những cung đường định thử. Chỉ là không muốn xếp chúng vào một cái lịch trình theo giờ.",
        "Cái thiếu không phải là kế hoạch. Cái thiếu là chỗ để cất mấy thứ đó lại, để đến hôm rảnh thì mở ra chọn chứ không phải ngồi nhớ.",
      ],
    },
    {
      heading: "Cái mất khi đi không kế hoạch là cái nhớ được",
      paragraphs: [
        "Đi ngẫu hứng gần như luôn vui hơn đi theo lịch trình. Nhưng một tuần sau thì còn lại gì? Bốn trăm tấm ảnh trong máy, không nhớ quán đó tên gì, không nhớ hôm đó đi qua đường nào, và lần sau có người hỏi thì kể được đúng hai câu.",
        "Chuyến đi có kế hoạch thì tự nó đã là một văn bản: có lịch trình để đọc lại. Chuyến đi không kế hoạch thì không có gì cả, nên nó là chuyến đi cần được ghi lại hơn, chứ không phải ít hơn.",
      ],
    },
    {
      heading: "Ba thứ thay cho một bản kế hoạch",
      items: [
        {
          label: "Một danh sách chỗ muốn tới",
          body: "Thấy chỗ nào hay thì ghim vào bản đồ ngay lúc đó, đánh dấu là muốn tới. Không cần biết bao giờ mới đi. Đến hôm rảnh thì mở danh sách ra, đó là lúc nó có ích.",
        },
        {
          label: "Một cách quyết nhanh",
          body: "Bí quá thì để vòng quay bốc, ngay trong số quán bạn đã ghim và đang mở cửa vào giờ đó. Không phải gõ lại danh sách, không phải tranh luận thêm mười lăm phút.",
        },
        {
          label: "Một bản ghi tự viết",
          body: "Bật dẫn đường thì đường đã đi và tổng số ki lô mét được giữ lại. Về nhà thả ảnh vào là thành một dòng kỷ niệm có ngày tháng. Không ai phải ngồi viết tường thuật.",
        },
      ],
    },
    {
      heading: "Đi tới đâu tính tới đó, nhưng đừng để mất đường về",
      paragraphs: [
        "Đi không kế hoạch hay dẫn tới những chỗ mạng yếu. Bản đồ ở đây giữ lại phần đã tải, nên mất mạng giữa đường thì vẫn còn thấy đường và còn nghe được giọng chỉ đường — thứ mà lúc đang chạy xe thì quan trọng hơn mọi lịch trình.",
        "Nếu đi hai người, cả hai thấy nhau trên cùng một bản đồ và hẹn được một điểm giữa. Không cần thống nhất trước giờ nào gặp ở đâu.",
      ],
    },
    {
      heading: "Và khi thật sự cần một kế hoạch",
      paragraphs: [
        "Có những chuyến buộc phải tính: vé, phòng, ai mang cái gì. Chỗ đó vẫn có — lịch trình chia theo từng ngày, một con số ngân sách, một checklist chia việc cho hai người.",
        "Điểm khác là nó không bắt buộc. Một chuyến đi ở đây có thể chỉ gồm một cái tên và mấy tấm ảnh chụp sau đó, và như thế vẫn được tính là một chuyến đi.",
      ],
    },
  ],
  faq: [
    {
      question: "Đi chơi không kế hoạch thì cần chuẩn bị gì?",
      answer:
        "Thực tế chỉ cần hai thứ: một danh sách chỗ bạn từng thấy hay, và một cách để nhớ lại chuyến đi sau đó. Cái đầu nên chuẩn bị dần, mỗi lần thấy một chỗ thì ghim một chỗ, chứ không phải ngồi làm trong một buổi tối. Cái sau thì nên tự động, vì không ai vừa đi chơi vừa viết nhật ký.",
    },
    {
      question: "App có sẵn danh sách địa điểm để gợi ý không?",
      answer:
        "Không. Đây là chỗ giữ danh sách của riêng bạn, không phải một cẩm nang du lịch — nó không có kho địa điểm sẵn, không xếp hạng theo khoảng cách và không gợi ý chỗ lạ. Thứ nó làm tốt hơn một cẩm nang là nhớ đúng những chỗ bạn đã để ý, kể cả chỗ chỉ có bạn thấy hay.",
    },
    {
      question: "Có cần tải ứng dụng không?",
      answer:
        "Không. Mở bằng trình duyệt trên điện thoại hay máy tính đều được, và miễn phí. Muốn nó nằm ở màn hình chính như một app thì thêm vào Home Screen, còn không thì cứ mở bằng link.",
    },
    {
      question: "Đi một mình thì dùng được không?",
      answer:
        "Được, đủ cả. Ghim chỗ, quay chọn quán, giữ lịch sử chuyến đi, viết kỷ niệm — không thứ nào đòi phải có người thứ hai. Khi nào muốn thì gửi mã mời, không thì thôi.",
    },
  ],
  cta: {
    heading: "Ghim vài chỗ trước đã",
    body: "Chưa cần biết cuối tuần đi đâu. Ghim ba bốn chỗ bạn từng thấy hay, để đó, hôm nào rảnh mở ra là có sẵn.",
    label: "Mở bản đồ của bạn",
  },
  related: [
    {
      href: "/khong-biet-di-dau",
      label: "Không biết đi đâu",
      blurb: "Khi đã rảnh rồi mà vẫn không chọn được chỗ nào.",
    },
    {
      href: "/nhat-ky-du-lich",
      label: "Nhật ký du lịch",
      blurb: "Chuyến đi thành một trang có ngày tháng và ảnh.",
    },
    {
      href: "/hom-nay-an-gi",
      label: "Hôm nay ăn gì",
      blurb: "Vòng quay bốc từ chính những quán bạn đã ghim.",
    },
  ],
};
