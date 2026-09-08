// Link → embed parser shared by memories (embedded media) and the collections
// library (music / food videos). Pure client-side URL parsing — no network — so
// it stays free-tier friendly. YouTube & Spotify get real iframe embeds +
// thumbnails; TikTok gets an oEmbed iframe; Instagram uses its public /embed
// iframe (no auth needed). Unknown links become a generic link card.

export type EmbedProvider =
  "youtube" | "spotify" | "tiktok" | "instagram" | "other";

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

/**
 * TikTok's embed player.
 *
 * `/embed/v2/<id>` — what this file used to build — answers HTTP 400 today, so
 * every TikTok link in the library was a frame that could not load. The
 * documented endpoint is `/player/v1/<id>`, driven by query parameters
 * (developers.tiktok.com/doc/embed-player), and it answers 200.
 *
 * Built from the id on demand rather than read back from the `embedUrl` stored
 * with the row, so links saved before this fix play without touching a single
 * database record.
 */
export const TIKTOK_ORIGIN = "https://www.tiktok.com";

export type TikTokPlayerOptions = {
  autoplay?: boolean;
  loop?: boolean;
  /** The creator's caption, inside the player. */
  description?: boolean;
  /** The track's name, inside the player. */
  musicInfo?: boolean;
  /** TikTok's suggestions after the video — off, or the list is left behind. */
  related?: boolean;
  /** Silent, and the viewer cannot change it from inside the player. */
  muted?: boolean;
};

export function tiktokPlayerUrl(
  id: string,
  o: TikTokPlayerOptions = {},
): string {
  const p = new URLSearchParams({
    autoplay: o.autoplay ? "1" : "0",
    loop: o.loop ? "1" : "0",
    description: o.description ? "1" : "0",
    music_info: o.musicInfo ? "1" : "0",
    rel: o.related ? "1" : "0",
    muted: o.muted ? "1" : "0",
    controls: "1",
    // The browser's own menu over a video is noise in a full-screen feed.
    native_context_menu: "0",
  });
  return `${TIKTOK_ORIGIN}/player/v1/${id}?${p.toString()}`;
}

/**
 * The numeric post id of a TikTok link, or null.
 *
 * Only the long form carries one. A short link (vm.tiktok.com/CODE) is a
 * redirect, and resolving it needs a request TikTok answers only to a real
 * browser — so those stay link cards, as they always have.
 */
export function tiktokPostId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const id = tiktokId(new URL(url));
    return id && /^\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Links that get the full-screen swipe feed instead of the floating dock. */
export function isFeedProvider(provider: string | null | undefined): boolean {
  return provider === "tiktok";
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
        // A short-link code is not a post id and cannot be played; it stays a
        // link card. See tiktokPlayerUrl for why this endpoint.
        embedUrl: isNumericId ? tiktokPlayerUrl(id) : null,
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
