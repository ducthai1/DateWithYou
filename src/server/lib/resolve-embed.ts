// Server-only embed enrichment. `parseEmbed` is pure/sync; some providers need
// a network round-trip to become embeddable. TikTok short-links (vm.tiktok.com)
// hide the numeric video id, and every playback path needs that id. Runs once
// at create/update time so the result is persisted; the live render never hits
// the network.

import { parseEmbed, tiktokPlayerUrl, tiktokPostId, type ParsedEmbed } from "@/lib/embed";
import { canonicalTikTokUrl } from "@/server/lib/resolve-tiktok-link";

export type ResolvedEmbed = ParsedEmbed & { title: string | null };

type TikTokOEmbed = {
  embed_product_id?: string;
  thumbnail_url?: string;
  title?: string;
};

/** Ảnh bìa + tiêu đề từ oEmbed. Chỉ nhận link dạng dài — đo 18/09/2026: link
 *  rút gọn bị trả 400, nên phải giải link TRƯỚC rồi mới hỏi tới đây. */
async function tiktokOEmbed(canonical: string): Promise<TikTokOEmbed | null> {
  try {
    const res = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(canonical)}`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return null;
    return (await res.json()) as TikTokOEmbed;
  } catch {
    return null;
  }
}

/** Enrich a pasted URL with provider data, resolving TikTok short-links and
 *  fetching its poster. Always returns something usable — on any network/parse
 *  failure it falls back to the pure sync parse so saving never blocks on a
 *  flaky upstream. */
export async function resolveEmbed(url: string): Promise<ResolvedEmbed> {
  const parsed = parseEmbed(url);
  const base: ResolvedEmbed = { ...parsed, title: null };

  if (parsed.provider !== "tiktok") return base;

  /*
   * Link đầy đủ là thứ được lưu xuống, không phải link người dùng dán.
   *
   * Trình phát ở client đọc id ra từ CHÍNH `url` của bản ghi (`tiktokPostId`),
   * nên lưu lại link rút gọn là để lại một hàng không bao giờ phát được — kể cả
   * khi `embedUrl` đúng, vì hai đường đó phải nói cùng một chuyện. Lưu link đầy
   * đủ thì cả hai cùng chạy, và nút "mở bài gốc" cũng trỏ tới một URL ổn định.
   */
  const canonical = (await canonicalTikTokUrl(url)) ?? url;
  const id = tiktokPostId(canonical);
  /*
   * Không giải được thì để nguyên thành thẻ link.
   *
   * `parseEmbed` cố ý trả `embedUrl: null` khi id không phải số, và điều đó
   * phải được giữ: nhét một mã rút gọn vào URL trình phát thì TikTok vẫn đáp
   * HTTP 200 — nhưng là 200 của một trang lỗi nằm trong khung. Một thẻ link
   * bấm được thì thành thật hơn một khung đen.
   */
  if (!id) return base;

  const data = await tiktokOEmbed(canonical);

  return {
    ...base,
    url: canonical,
    embedId: id,
    /*
     * Cùng một hàm dựng URL với client.
     *
     * Chỗ này từng tự ghép `/embed/v2/<id>` trong khi `embed.ts` dựng
     * `/player/v1/<id>` — hai nguồn sự thật cho một cái iframe. Đo 18/09/2026:
     * `/embed/v2/` trả 400 với id không tồn tại còn `/player/v1/` thì không,
     * nên một id hỏng ở đường cũ là một khung trắng.
     */
    embedUrl: tiktokPlayerUrl(id, { description: true, musicInfo: true }),
    thumbnailUrl: data?.thumbnail_url ?? parsed.thumbnailUrl,
    title: data?.title ?? null,
  };
}
