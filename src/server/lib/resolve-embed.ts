// Server-only embed enrichment. `parseEmbed` is pure/sync; some providers need
// a network round-trip to become embeddable. TikTok short-links (vm.tiktok.com)
// hide the numeric video id and TikTok gives no thumbnail from the URL alone —
// its public oEmbed endpoint (no auth) resolves both. Runs once at create/update
// time so the result is persisted; the live render never hits the network.

import { parseEmbed, type ParsedEmbed } from "@/lib/embed";

export type ResolvedEmbed = ParsedEmbed & { title: string | null };

type TikTokOEmbed = {
  embed_product_id?: string;
  thumbnail_url?: string;
  title?: string;
};

/** Enrich a pasted URL with provider data, resolving TikTok via oEmbed. Always
 *  returns something usable — on any network/parse failure it falls back to the
 *  pure sync parse so saving never blocks on a flaky upstream. */
export async function resolveEmbed(url: string): Promise<ResolvedEmbed> {
  const parsed = parseEmbed(url);
  const base: ResolvedEmbed = { ...parsed, title: null };

  if (parsed.provider !== "tiktok") return base;

  try {
    const res = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return base;
    const data = (await res.json()) as TikTokOEmbed;
    const id = data.embed_product_id;
    return {
      ...base,
      embedId: id ?? parsed.embedId,
      // Numeric product id → canonical embed iframe (handles short-links too).
      embedUrl: id ? `https://www.tiktok.com/embed/v2/${id}` : parsed.embedUrl,
      thumbnailUrl: data.thumbnail_url ?? parsed.thumbnailUrl,
      title: data.title ?? null,
    };
  } catch {
    // Timeout / network / bad JSON — keep the sync parse result.
    return base;
  }
}
