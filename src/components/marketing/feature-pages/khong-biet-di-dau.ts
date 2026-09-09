import type { FeaturePage } from "./types";

/**
 * Target intent: "không biết đi đâu", "hôm nay đi đâu", "cuối tuần đi đâu",
 * "đi đâu bây giờ", "cuối tuần làm gì", "rảnh không biết làm gì".
 *
 * Why this is a separate page from /di-choi-khong-ke-hoach, and not a section
 * of it. The two look like one topic and are two different moments: that page
 * is about a way of travelling, chosen in advance; this one is about being
 * stuck, right now, with the evening already free. A reader in the second
 * moment has no patience for an argument about how to travel, and the queries
 * differ accordingly — so one page each, per the note in types.ts.
 *
 * The honest limits are stated on the page itself rather than buried in the
 * FAQ, because they are the first thing this kind of visitor will test: there
 * is no suggestion engine, no "chỗ hay gần đây", no distance sorting. What the
 * app has is the list you built yourself, filtered to what is open at that
 * hour (LocationModel openTime/closeTime, which food-wheel.tsx checks against
 * the clock, overnight ranges included). The last section is about not going
 * out at all, which is the honest answer for a good share of these searches.
 */
export const KHONG_BIET_DI_DAU: FeaturePage = {
  slug: "khong-biet-di-dau",
  metaTitle: "Không biết đi đâu? Mở danh sách chỗ bạn từng muốn tới",
  metaDescription:
    "Cuối tuần rảnh mà không nghĩ ra đi đâu, thường không phải vì thiếu chỗ — mà vì những chỗ hay đã trôi mất trong tin nhắn. Đây là nơi giữ lại và chọn nhanh. Miễn phí.",
  h1: "Không biết đi đâu?",
  eyebrow: "Cuối tuần rảnh",
  tagline:
    "Chuyện này gần như không bao giờ vì thiếu chỗ. Nó vì những chỗ hay đã trôi đi đâu mất rồi.",
  art: "mapIsland",
  sections: [
    {
      heading: "Bạn từng biết chỗ nào rồi, chỉ là không nhớ ra lúc cần",
      paragraphs: [
        "Nghĩ lại một chút: tháng vừa rồi bạn đã thấy ít nhất năm sáu chỗ trông đáng đi. Một cái reel lưu lại rồi quên, một tin nhắn đứa bạn gửi link, một ảnh chụp màn hình nằm giữa bốn trăm ảnh khác, một quán đi ngang thấy đông người.",
        "Không chỗ nào trong số đó còn tìm lại được vào tối thứ Bảy, lúc câu hỏi thật sự xuất hiện. Nên câu trả lời quen thuộc lại là chỗ cũ, hoặc là thôi ở nhà.",
      ],
    },
    {
      heading: "Một danh sách “muốn tới” giải quyết đúng chuyện đó",
      paragraphs: [
        "Ghim một chỗ mất mười giây và làm được ngay lúc vừa thấy nó — không phải lúc đang cần đi. Mỗi chỗ có khu vực, loại hình, giờ mở cửa, và một dòng ghi chú kiểu 'đi ăn thử món kia'.",
        "Đến hôm rảnh thì việc phải làm không còn là nhớ ra chỗ nào, mà là chọn trong danh sách có sẵn. Hai việc đó khó không bằng nhau.",
      ],
      items: [
        {
          label: "Muốn tới và đã đi, tách riêng",
          body: "Chỗ chưa đi nằm ở danh sách muốn tới. Đi rồi thì đánh dấu đã đi, kèm ngày và ghi chú — thành một bản đồ những nơi hai người từng ghé.",
        },
        {
          label: "Lọc theo khu vực và loại hình",
          body: "Muốn đi ăn thì xem đúng nhóm quán ăn, muốn cà phê ngồi lâu thì xem nhóm cà phê, và xem trong khu vực nào cho đỡ phải đi xa.",
        },
        {
          label: "Bấm là có đường đi",
          body: "Chọn xong thì mở dẫn đường ngay, có giọng đọc để không phải nhìn màn hình. Mất mạng giữa đường vẫn còn phần bản đồ đã tải.",
        },
      ],
    },
    {
      heading: "Vẫn không chọn được thì đừng chọn nữa",
      paragraphs: [
        "Có những tối mà mọi lựa chọn đều nghe hay như nhau, và bàn thêm mười lăm phút cũng không ra. Vòng quay ở đây bốc giúp — trong đúng số quán bạn đã ghim, và chỉ những chỗ đang mở cửa vào giờ đó.",
        "Nói rõ để bạn không kỳ vọng sai: nó không có kho địa điểm sẵn, không gợi ý chỗ lạ, không sắp theo khoảng cách tới bạn. Nó bốc từ danh sách của bạn, và đó cũng là lý do kết quả luôn là chỗ bạn từng thật sự muốn đi.",
      ],
    },
    {
      heading: "Hoặc không đi đâu cả, cũng là một câu trả lời",
      paragraphs: [
        "Kha khá lần tìm 'cuối tuần làm gì' kết thúc bằng việc ở nhà, và như thế cũng không sao. Danh sách những điều muốn làm cùng nhau nằm sẵn trong két: một ý tưởng ghi hôm nào đó, đến lúc rảnh thì kéo sang đang tính, làm xong thì đánh dấu đã làm.",
        "Không nghĩ ra gì thì có bộ công thức để nấu thử, và mấy trò kinh điển chơi trực tiếp với người kia ngay trong Bộ sưu tập — cờ vây, caro, UNO, Ma Sói, Nối từ, Xì dách.",
      ],
    },
  ],
  faq: [
    {
      question: "Mở app lên có gợi ý sẵn chỗ đi chơi không?",
      answer:
        "Không, và đó là chủ ý. Đây là danh sách của riêng bạn chứ không phải một trang cẩm nang: nó không có kho địa điểm sẵn và không xếp theo khoảng cách. Đổi lại, mọi chỗ hiện ra đều là chỗ bạn hoặc người kia từng thấy hay, nên gần như không có kết quả nào phải bỏ qua.",
    },
    {
      question: "Chưa lưu chỗ nào thì bắt đầu thế nào?",
      answer:
        "Ghim ba bốn chỗ bạn nhớ ra ngay bây giờ, kể cả chỗ đã đi rồi. Từ đó thì cứ thấy chỗ nào hay là ghim thêm một chỗ, mười giây một lần. Sau vài tuần danh sách sẽ tự đủ dùng, và đó là lúc câu hỏi 'đi đâu' hết khó.",
    },
    {
      question: "Cuối tuần đi đâu gần đây thì app trả lời được không?",
      answer:
        "Không theo nghĩa tìm chỗ lạ quanh vị trí hiện tại — app không có chức năng đó. Nhưng mỗi chỗ bạn ghim đều có khu vực, nên lọc theo khu vực gần nhà là làm được, và bấm vào là mở dẫn đường tới đó.",
    },
    {
      question: "Có mất phí không?",
      answer:
        "Không. Miễn phí, chạy trên trình duyệt, không phải tải app. Dùng một mình cũng đủ chức năng, và khi nào muốn thì mời thêm một người vào cùng không gian.",
    },
  ],
  cta: {
    heading: "Ghim ba chỗ, ngay bây giờ",
    body: "Không cần chờ tới lúc rảnh. Ba chỗ bạn nhớ ra trong ba mươi giây là đủ để tối thứ Bảy tới có cái mở ra xem.",
    label: "Mở bản đồ của bạn",
  },
  related: [
    {
      href: "/di-choi-khong-ke-hoach",
      label: "Đi chơi không kế hoạch",
      blurb: "Đi mà không cần lịch trình, và vẫn giữ lại được.",
    },
    {
      href: "/luu-dia-diem-da-di",
      label: "Lưu địa điểm đã đi",
      blurb: "Chỗ đã ghé và chỗ muốn tới, trên một bản đồ.",
    },
    {
      href: "/hom-nay-an-gi",
      label: "Hôm nay ăn gì",
      blurb: "Khi câu hỏi là ăn gì chứ không phải đi đâu.",
    },
  ],
};
