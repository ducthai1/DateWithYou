// Link → embed parser shared by memories (embedded media) and the collections
// library (music / food videos). Pure client-side URL parsing — no network — so
// it stays free-tier friendly. YouTube & Spotify get real iframe embeds +
// thumbnails; TikTok/Instagram fall back to a link card (their embeds are heavy
// and unreliable). Unknown links become a generic link card.

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
  if (host.includes("tiktok.com")) return { ...base, provider: "tiktok" };
  if (host.includes("instagram.com")) return { ...base, provider: "instagram" };
  return base;
}

export const PROVIDER_LABEL: Record<EmbedProvider, string> = {
  youtube: "YouTube",
  spotify: "Spotify",
  tiktok: "TikTok",
  instagram: "Instagram",
  other: "Link",
};
