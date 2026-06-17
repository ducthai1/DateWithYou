// Link → embed parser shared by memories (embedded media) and the collections
// library (music / food videos). Pure client-side URL parsing — no network — so
// it stays free-tier friendly. YouTube & Spotify get real iframe embeds +
// thumbnails; TikTok gets an oEmbed iframe; Instagram falls back to a link card
// (their embeds require auth). Unknown links become a generic link card.

export type EmbedProvider = "youtube" | "spotify" | "tiktok" | "instagram" | "other";

export type ParsedEmbed = {
  provider: EmbedProvider;
  url: string;
  embedId: string | null;
  embedUrl: string | null; // iframe src when embeddable
  thumbnailUrl: string | null;
};

function youtubeId(u: URL): string | null {
  if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
  if (u.searchParams.get("v")) return u.searchParams.get("v");
  const m = u.pathname.match(/\/(embed|shorts)\/([\w-]+)/);
  return m?.[2] ?? null;
}

function spotify(u: URL): { kind: string; id: string } | null {
  const m = u.pathname.match(/\/(track|playlist|album|episode|show)\/([\w]+)/);
  return m ? { kind: m[1], id: m[2] } : null;
}

/**
 * Extract an Instagram post/reel/tv shortcode. The `/embed` URL is publicly
 * iframe-embeddable (no auth/app token needed), so we can show posts inline.
 *   - https://www.instagram.com/p/CODE/
 *   - https://www.instagram.com/reel/CODE/  (and /reels/CODE/)
 *   - https://www.instagram.com/tv/CODE/
 */
function instagram(u: URL): { kind: string; code: string } | null {
  const m = u.pathname.match(/\/(p|reel|reels|tv)\/([\w-]+)/);
  if (!m) return null;
  const kind = m[1] === "reels" ? "reel" : m[1];
  return { kind, code: m[2] };
}

/**
 * Extract a TikTok video ID from the URL path.
 * Handles formats:
 *   - https://www.tiktok.com/@user/video/1234567890
 *   - https://www.tiktok.com/@user/photo/1234567890
 *   - https://vm.tiktok.com/AbCdEf/  (short links — ID is the path segment)
 *   - https://www.tiktok.com/t/AbCdEf/ (another short format)
 */
function tiktokId(u: URL): string | null {
  // Long-form: /@user/video/ID or /@user/photo/ID
  const longMatch = u.pathname.match(/\/(video|photo)\/(\d+)/);
  if (longMatch) return longMatch[2];
  // Short links: vm.tiktok.com/CODE/ or tiktok.com/t/CODE/
  const host = u.hostname.replace(/^www\./, "");
  if (host === "vm.tiktok.com") {
    const code = u.pathname.replace(/^\/+|\/+$/g, "");
    return code || null;
  }
  const shortMatch = u.pathname.match(/^\/t\/([A-Za-z0-9_-]+)/);
  if (shortMatch) return shortMatch[1];
  return null;
}

/** Parse a pasted URL into provider + embed info. Returns provider "other" for
 *  anything unrecognised (still stored + shown as a link). */
export function parseEmbed(rawUrl: string): ParsedEmbed {
  const base: ParsedEmbed = {
    provider: "other",
    url: rawUrl,
    embedId: null,
    embedUrl: null,
    thumbnailUrl: null,
  };
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return base;
  }
  const host = u.hostname.replace(/^www\./, "");

  if (host.includes("youtube.com") || host.includes("youtu.be")) {
    const id = youtubeId(u);
    if (id)
      return {
        provider: "youtube",
        url: rawUrl,
        embedId: id,
        embedUrl: `https://www.youtube.com/embed/${id}`,
        thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      };
  }
  if (host.includes("spotify.com")) {
    const s = spotify(u);
    if (s)
      return {
        provider: "spotify",
        url: rawUrl,
        embedId: `${s.kind}/${s.id}`,
        embedUrl: `https://open.spotify.com/embed/${s.kind}/${s.id}`,
        thumbnailUrl: null,
      };
  }
  if (host.includes("tiktok.com")) {
    const id = tiktokId(u);
    if (id) {
      // For long-form video IDs (numeric), use the TikTok embed player.
      // For short-link codes, we still store them — the embed iframe
      // can handle the redirect, or we fall back to a link card.
      const isNumericId = /^\d+$/.test(id);
      return {
        provider: "tiktok",
        url: rawUrl,
        embedId: id,
        embedUrl: isNumericId
          ? `https://www.tiktok.com/embed/v2/${id}`
          : null, // short-link codes can't be directly embedded
        thumbnailUrl: null,
      };
    }
    // TikTok link that we couldn't parse — still tag as tiktok for the label
    return { ...base, provider: "tiktok" };
  }
  if (host.includes("instagram.com")) {
    const ig = instagram(u);
    if (ig)
      return {
        provider: "instagram",
        url: rawUrl,
        embedId: `${ig.kind}/${ig.code}`,
        embedUrl: `https://www.instagram.com/${ig.kind}/${ig.code}/embed`,
        thumbnailUrl: null,
      };
    return { ...base, provider: "instagram" };
  }
  return base;
}

/**
 * Normalize a pasted link so it survives the server's `https://`-only check.
 * People paste `youtube.com/…`, `www.youtu.be/…`, or `http://…` constantly;
 * without this they hit a silent validation error and nothing gets saved.
 * Returns "" for blank input so callers can treat it as "no url".
 */
export function normalizeUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (/^https:\/\//i.test(s)) return s;
  if (/^http:\/\//i.test(s)) return "https://" + s.slice(7);
  return "https://" + s.replace(/^\/+/, "");
}

export const PROVIDER_LABEL: Record<EmbedProvider, string> = {
  youtube: "YouTube",
  spotify: "Spotify",
  tiktok: "TikTok",
  instagram: "Instagram",
  other: "Link",
};
