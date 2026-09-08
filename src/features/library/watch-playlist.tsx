"use client";

import { useEffect, useRef } from "react";
import { AudioLines } from "lucide-react";
import { cn } from "@/lib/utils";
import { FadeScroll } from "@/components/ui/fade-scroll";
import type { NowPlayingItem } from "./now-playing-context";

/**
 * The playlist column of the watch page: the whole queue, the playing row
 * marked and kept in view. A pick jumps the shared queue; the page's URL
 * follows on its own (see WatchScreen).
 *
 * From lg up the card around it is as tall as the screen, so the list scrolls
 * inside a FadeScroll and fades where more rows hide — deliberately without
 * `overscroll-contain`: on a box that does not overflow, that rule swallows
 * the wheel and the page stops moving. On a phone the page itself scrolls.
 */
export function WatchPlaylist({
  queue,
  index,
  onPick,
}: {
  queue: readonly NowPlayingItem[];
  index: number;
  onPick: (index: number) => void;
}) {
  const activeRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (queue.length === 0) {
    return (
      <ul className="space-y-1 p-2" aria-busy="true">
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className="flex gap-3 rounded-xl p-2">
            <span className="bg-muted aspect-video w-28 shrink-0 animate-pulse rounded-lg" />
            <span className="flex-1 space-y-2 pt-1">
              <span className="bg-muted block h-3 w-4/5 animate-pulse rounded" />
              <span className="bg-muted block h-3 w-2/5 animate-pulse rounded" />
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <FadeScroll className="p-2">
      <ol className="space-y-1">
        {queue.map((q, i) => {
          const active = i === index;
          return (
            <li key={q.id} ref={active ? activeRef : null}>
              <button
                type="button"
                onClick={() => onPick(i)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "group flex w-full gap-3 rounded-xl p-2 text-left transition-colors",
                  active ? "bg-accent-soft" : "hover:bg-muted",
                )}
              >
                <span className="bg-muted relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg">
                  {q.thumbnailUrl && (
                    <img
                      src={q.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                  {active && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white">
                      <AudioLines className="h-5 w-5" aria-hidden="true" />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1 py-0.5">
                  <span
                    className={cn(
                      "line-clamp-2 text-sm leading-snug font-semibold",
                      active
                        ? "text-accent"
                        : "text-foreground group-hover:text-accent",
                    )}
                  >
                    {q.title}
                  </span>
                  <span className="text-muted-foreground mt-1 block text-xs">
                    {q.providerLabel}
                    {active && " · Đang phát"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </FadeScroll>
  );
}
