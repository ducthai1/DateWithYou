"use client";

import { ExternalLink, Play } from "lucide-react";
import { PROVIDER_LABEL, type EmbedProvider } from "@/lib/embed";

type EmbedData = {
  provider: EmbedProvider;
  url: string;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  title?: string | null;
};

/** Renders an inline iframe for embeddable providers (YouTube/Spotify); a
 *  thumbnail/link card otherwise. Lazy iframes keep the page light. */
export function EmbedPlayer({ data }: { data: EmbedData }) {
  if (data.embedUrl && data.provider === "youtube") {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl">
        <iframe
          src={data.embedUrl}
          title={data.title ?? "YouTube"}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </div>
    );
  }
  if (data.embedUrl && data.provider === "spotify") {
    return (
      <iframe
        src={data.embedUrl}
        title={data.title ?? "Spotify"}
        loading="lazy"
        allow="encrypted-media"
        className="w-full rounded-xl border-0"
        style={{ height: 152 }}
      />
    );
  }
  // Fallback link card (TikTok / Instagram / other).
  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="border-border bg-card hover:border-accent flex items-center gap-3 rounded-xl border p-3 transition-colors"
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
