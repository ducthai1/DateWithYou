import { parseEmbed, type EmbedProvider } from "@/lib/embed";
import { resolveEmbed } from "@/server/lib/resolve-embed";

/**
 * The name a pasted video or song link already has, for the library form.
 *
 * Saving a YouTube link meant typing out the video's title by hand, though
 * YouTube, Spotify and TikTok all answer "what is this?" through oEmbed. Only
 * those three are asked, at their own fixed endpoints with the link as a
 * parameter — the link itself is never fetched, so pasting an address on the
 * server's own network gets nothing back.
 */

const OEMBED: Partial<Record<EmbedProvider, (url: string) => string>> = {
  youtube: (u) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  spotify: (u) => `https://open.spotify.com/oembed?url=${encodeURIComponent(u)}`,
};

/** The library's own limit for a title. */
const MAX_TITLE = 160;

/** A TikTok caption is the video's title, hashtags and all; the hashtags are not part of the name. */
export function cleanTitle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.replace(/#[^\s#]+/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length <= MAX_TITLE ? t : t.slice(0, MAX_TITLE).trim();
}

export async function linkTitle(url: string): Promise<{ title: string | null; provider: EmbedProvider }> {
  const parsed = parseEmbed(url);
  if (parsed.provider === "tiktok") {
    // Short links have to be resolved before oEmbed answers; resolveEmbed does both.
    const resolved = await resolveEmbed(url);
    return { title: cleanTitle(resolved.title), provider: "tiktok" };
  }
  const endpoint = OEMBED[parsed.provider];
  if (!endpoint || !parsed.embedId) return { title: null, provider: parsed.provider };
  try {
    const res = await fetch(endpoint(url), { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return { title: null, provider: parsed.provider };
    const body = (await res.json()) as { title?: unknown };
    return { title: cleanTitle(typeof body.title === "string" ? body.title : null), provider: parsed.provider };
  } catch {
    return { title: null, provider: parsed.provider };
  }
}
