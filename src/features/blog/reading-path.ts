/**
 * The order to read the blog in, for someone who has never opened the app.
 *
 * A blog index sorted by date answers "what is new" and nothing else. A person
 * who landed here from a search result does not need what is new — they need
 * to know what this thing is, what to do first, and what to do after that. Six
 * posts, in the order the app is actually used: open a space, pin a place, go
 * there together, let the wheel choose, keep the day, and get told when the
 * other person adds something.
 *
 * Titles and blurbs are written here, not read from the database, so the
 * landing page — which is fully static — can show the path without a query.
 * The blog index swaps in the live title when the post exists, and drops a
 * step whose post has been unpublished rather than linking to a 404.
 */
export type ReadingStep = {
  slug: string;
  /** Two or three words — the verb of the step. */
  step: string;
  title: string;
  blurb: string;
};

export const READING_PATH: ReadingStep[] = [
  {
    slug: "khong-gian-cap-doi-moi-nguoi-kia",
    step: "Mở cửa",
    title: "Không gian riêng và cách mời người kia vào",
    blurb: "Mọi thứ trong app sống trong một không gian của hai người. Bắt đầu từ đây để hiểu cái “chốn” đó là gì.",
  },
  {
    slug: "ban-do-luu-quan-da-di",
    step: "Ghim chỗ đầu tiên",
    title: "Bản đồ riêng: quán đã ghé và chỗ muốn tới",
    blurb: "Việc đầu tiên nên làm sau khi có không gian — ghim ba bốn quán để những phần khác có thứ để dùng.",
  },
  {
    slug: "dan-duong-cho-hai-nguoi",
    step: "Đi tới đó",
    title: "Dẫn đường cho hai người, kể cả khi mất mạng",
    blurb: "Gửi lời mời, thấy nhau trên đường, hẹn ở điểm giữa — và chuyện gì xảy ra khi 4G rớt giữa đường.",
  },
  {
    slug: "vong-quay-hom-nay-an-gi",
    step: "Hết ý tưởng",
    title: "Hôm nay ăn gì? Để vòng quay bốc từ chính quán bạn đã lưu",
    blurb: "Câu hỏi mỗi tối, trả lời bằng chính danh sách bạn vừa ghim ở bước trên.",
  },
  {
    slug: "dong-ky-niem-muoi-anh",
    step: "Giữ lại",
    title: "Dòng kỷ niệm: 30 tấm ảnh, vài dòng, và một cảm xúc",
    blurb: "Đi rồi thì viết lại — không phải một bài dài, chỉ vài tấm ảnh và một câu.",
  },
  {
    slug: "thong-bao-day-biet-ngay",
    step: "Không bỏ lỡ",
    title: "Thông báo đẩy: biết ngay khi người kia thêm điều gì",
    blurb: "Bật một lần để không phải mở app kiểm tra — điện thoại tự báo khi có chuyện.",
  },
];
