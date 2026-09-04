"use client";

import { ExternalLink, Play } from "lucide-react";
import { PROVIDER_LABEL, type EmbedProvider } from "@/lib/embed";

/**
 * Natural shape of each provider's frame, as width ÷ height. `null` means the
 * embed is an audio bar of fixed height rather than a video box.
 *
 * The floating player needs this: it owns its own size, so it has to know what
 * shape to give the frame instead of inheriting the per-provider heights below.
 */
export const EMBED_ASPECT: Record<EmbedProvider, number | null> = {
  youtube: 16 / 9,
  spotify: null,
  tiktok: 9 / 16,
  instagram: 4 / 5,
  other: 16 / 9,
};

/** Spotify's own compact-player height. Anything shorter clips its controls. */
export const SPOTIFY_BAR_HEIGHT = 152;

export type EmbedData = {
  provider: EmbedProvider;
  url: string;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  title?: string | null;
};

/** Inline media player with a click-to-play facade: shows a lightweight
 *  thumbnail/placeholder + play button first, and only mounts the heavy iframe
 *  once the user taps it. Keeps feeds (many cards × many links) light and avoids
 *  navigating away to a detail screen. Non-embeddable links fall back to a card. */
export function EmbedPlayer({ data, fill = false }: { data: EmbedData; fill?: boolean }) {
  // No iframe possible (unparsed TikTok short-link, plain links) → link card.
  if (!data.embedUrl) {
    return (
      <a
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        className="border-border bg-card hover:border-accent flex w-full min-w-0 items-center gap-3 rounded-xl border p-3 transition-colors"
      >
        <span className="bg-accent-soft text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
          <Play className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{data.title || PROVIDER_LABEL[data.provider]}</p>
          <p className="text-muted-foreground truncate text-xs">{data.url}</p>
        </div>
        <ExternalLink className="text-muted-foreground h-4 w-4 shrink-0" />
      </a>
    );
  }

  /*
   * The floating player has already worked out the box from EMBED_ASPECT, so
   * the frame just fills it. Keeping the provider heights below would make the
   * window either clip the frame or wrap it in dead space.
   */
  if (fill) {
    return (
      <iframe
        src={data.embedUrl}
        title={data.title ?? PROVIDER_LABEL[data.provider]}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full border-0"
      />
    );
  }

  if (data.provider === "youtube") {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl">
        <iframe
          src={data.embedUrl}
          title={data.title ?? "YouTube"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="h-full w-full border-0"
        />
      </div>
    );
  }
  if (data.provider === "spotify") {
    return (
      <iframe
        src={data.embedUrl}
        title={data.title ?? "Spotify"}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        className="w-full rounded-xl border-0"
        style={{ height: 152 }}
      />
    );
  }
  if (data.provider === "tiktok") {
    return (
      <div className="mx-auto w-full max-w-[325px] overflow-hidden rounded-xl">
        <iframe
          src={data.embedUrl}
          title={data.title ?? "TikTok"}
          sandbox="allow-popups allow-popups-to-escape-sandbox allow-scripts allow-top-navigation allow-same-origin"
          allowFullScreen
          loading="lazy"
          className="w-full border-0"
          style={{ height: 740 }}
        />
      </div>
    );
  }
  // Instagram (public /embed iframe).
  return (
    <div className="mx-auto w-full max-w-[400px] overflow-hidden rounded-xl">
      <iframe
        src={data.embedUrl}
        title={data.title ?? "Instagram"}
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-scripts allow-top-navigation allow-same-origin"
        allowFullScreen
        loading="lazy"
        className="w-full border-0"
        style={{ height: 560 }}
      />
    </div>
  );
}
