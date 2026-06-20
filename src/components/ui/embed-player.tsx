"use client";

import { useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import { PROVIDER_LABEL, type EmbedProvider } from "@/lib/embed";

type EmbedData = {
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
export function EmbedPlayer({ data }: { data: EmbedData }) {
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
