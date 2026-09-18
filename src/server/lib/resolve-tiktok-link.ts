import { tiktokPostId } from "@/lib/embed";

/**
 * Đổi link TikTok rút gọn thành link đầy đủ.
 *
 * Bấm Chia sẻ trong app TikTok thì ra `vm.tiktok.com/XXXX/` — và **đó là dạng
 * link mà người ta thực sự dán vào**, không phải dạng dài lấy từ trình duyệt.
 * Dạng rút gọn không mang id bài viết, mà cả hai đường phát video đều cần id:
 * `embedUrl` lưu ở server dựng từ id, và trình phát ở client cũng đọc id ra từ
 * chính URL. Không có id ⇒ mọi thứ rơi về một thẻ link bấm ra tab mới.
 *
 * oEmbed của TikTok **từ chối thẳng link rút gọn** — đo ngày 18/09/2026: trả
 * 400 `{"message":"Something went wrong"}`. Nên nó không phải đường ra.
 *
 * Đường ra là chuyển hướng: một `fetch` thường kèm User-Agent trình duyệt nhận
 * được 302 với `Location` chứa id. Comment cũ trong `embed.ts` ghi rằng "chỉ
 * trình duyệt thật mới giải được nên đành để làm thẻ link" — đo lại thì không
 * đúng, và đó là lý do tính năng này nằm im suốt.
 */

/*
 * Chỉ đi theo chuyển hướng TRONG TikTok.
 *
 * Đây là một máy chủ đi lấy một URL do người dùng đưa vào, tức là bề mặt SSRF.
 * Một chuyển hướng trỏ về `http://169.254.169.254/` hay một địa chỉ nội bộ mà
 * cứ thế đi theo là biến tính năng này thành một cái proxy dò mạng nội bộ.
 * Danh sách trắng theo tên miền là ranh giới, và nó được kiểm ở MỌI chặng chứ
 * không chỉ chặng đầu.
 */
const TIKTOK_HOSTS = [
  "tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com", "m.tiktok.com",
];

function isTikTokHost(u: URL): boolean {
  const host = u.hostname.toLowerCase();
  return TIKTOK_HOSTS.includes(host) || host.endsWith(".tiktok.com");
}

/**
 * Bỏ phần truy vấn.
 *
 * Cả hai lối đều phải đi qua đây. Link chuyển hướng mang một chuỗi tham số theo
 * dõi dài dằng dặc (`_r`, `_d`, `share_item_id`, `timestamp`…), còn link dán từ
 * trình duyệt thì mang `?is_from_webapp=…`. Giữ lại thì cùng một video lưu hai
 * lần ra hai URL khác nhau, và không chỗ nào trong app nhận ra đó là một bài.
 */
function strip(u: URL): string {
  u.search = "";
  u.hash = "";
  return u.toString();
}

/** Vài chặng là đủ; nhiều hơn là một vòng lặp chứ không phải một link. */
const MAX_HOPS = 3;
const TIMEOUT_MS = 4000;

/**
 * Link đầy đủ của một link TikTok bất kỳ, hoặc null.
 *
 * Trả về null — chứ không ném — ở mọi đường hỏng: một link không giải được vẫn
 * phải lưu được thành thẻ link như trước, chứ không được làm hỏng nguyên thao
 * tác lưu của người dùng.
 */
export async function canonicalTikTokUrl(raw: string): Promise<string | null> {
  let current: URL;
  try {
    current = new URL(raw);
  } catch {
    return null;
  }
  if (!isTikTokHost(current)) return null;
  // Đã là dạng dài rồi thì không cần đi đâu cả — nhưng vẫn phải rửa, xem `strip`.
  if (tiktokPostId(current.toString())) return strip(current);

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    let res: Response;
    try {
      res = await fetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        headers: {
          /*
           * TikTok trả về chuyển hướng cho trình duyệt và một trang chặn cho
           * thứ khác. Đây là điều kiện để nó chịu trả 302 — không phải để giả
           * danh ai.
           */
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
          "accept-language": "vi,en;q=0.9",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return null;
    }

    const location = res.headers.get("location");
    if (!location) return null;

    let next: URL;
    try {
      next = new URL(location, current);
    } catch {
      return null;
    }
    // Ranh giới được kiểm ở TỪNG chặng, không chỉ chặng đầu.
    if (!isTikTokHost(next)) return null;

    if (tiktokPostId(next.toString())) return strip(next);
    current = next;
  }
  return null;
}
