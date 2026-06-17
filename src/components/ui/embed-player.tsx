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
  const [active, setActive] = useState(false);

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

  if (!active) {
    return <Facade data={data} onPlay={() => setActive(true)} />;
  }

  if (data.provider === "youtube") {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl">
        <iframe
          src={`${data.embedUrl}?autoplay=1`}
          title={data.title ?? "YouTube"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
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
        allow="autoplay; encrypted-media"
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
        className="w-full border-0"
        style={{ height: 560 }}
      />
    </div>
  );
}

/** Provider-shaped click-to-play preview. Tapping it mounts the real iframe. */
function Facade({ data, onPlay }: { data: EmbedData; onPlay: () => void }) {
  const label = data.title || PROVIDER_LABEL[data.provider];

  // Spotify: compact horizontal bar (the player itself is short).
  if (data.provider === "spotify") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPlay();
        }}
        className="border-border bg-card hover:border-accent group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#1DB954] text-xl text-black">
          ♫
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{label}</p>
          <p className="text-muted-foreground text-xs">Nghe trên Spotify</p>
        </div>
        <span className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform group-hover:scale-110">
          <Play className="h-4 w-4 fill-current" />
        </span>
      </button>
    );
  }

  // Portrait facades for TikTok / Instagram; wide 16:9 for YouTube.
  const portrait = data.provider === "tiktok" || data.provider === "instagram";
  const wrapClass = portrait
    ? "mx-auto aspect-[9/16] w-full max-w-[260px]"
    : "aspect-video w-full";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onPlay();
      }}
      className={`group relative block overflow-hidden rounded-xl bg-muted ${wrapClass}`}
      aria-label={`Phát ${PROVIDER_LABEL[data.provider]}`}
    >
      {data.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.thumbnailUrl}
          alt={label}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <span className="bg-accent-soft text-accent flex h-full w-full items-center justify-center text-3xl font-bold">
          {data.provider === "tiktok" ? "TT" : data.provider === "instagram" ? "IG" : "▶"}
        </span>
      )}
      <span className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/30" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition-transform group-hover:scale-110">
          <Play className="ml-0.5 h-6 w-6 fill-current" />
        </span>
      </span>
      <span className="absolute bottom-0 left-0 right-0 truncate bg-gradient-to-t from-black/70 to-transparent p-2 text-left text-xs font-medium text-white">
        {label}
      </span>
    </button>
  );
}
