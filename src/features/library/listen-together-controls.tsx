"use client";

import { Headphones, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePartnerName } from "@/features/space/use-partner";
import { toListenTrack, type NowPlayingItem } from "./now-playing-context";
import type { ListenTogether } from "./use-listen-together";

/**
 * The three states of shared listening as one row: live, waiting, or the
 * invite button. Used by the floating dock and by the watch page, so both
 * say the same thing in the same words.
 *
 * `getState` is read at the moment of inviting, so the partner starts where
 * the host actually is — and, if the host has not started at all, so that
 * neither of them plays until the invite is answered.
 */
export function ListenTogetherControls({
  listen,
  queue,
  index,
  getState,
  size = "sm",
}: {
  listen: ListenTogether;
  queue: readonly NowPlayingItem[];
  index: number;
  getState: () => { positionSec: number; isPlaying: boolean };
  size?: "sm" | "md";
}) {
  const partnerName = usePartnerName();
  const invite = () => {
    const tracks = queue.map(toListenTrack).filter((t) => t.embedUrl);
    if (!tracks.length) return;
    const { positionSec, isPlaying } = getState();
    void listen.start(tracks, index, positionSec, isPlaying);
  };
  const text = size === "sm" ? "text-[11px]" : "text-sm";
  const pad = size === "sm" ? "px-2.5 py-1.5" : "px-3.5 py-2";

  if (listen.live) {
    return (
      <div className="pointer-events-auto flex w-full items-center gap-1.5">
        <span
          className={cn(
            "bg-accent text-accent-foreground flex min-w-0 flex-1 items-center gap-1.5 rounded-full",
            pad,
          )}
        >
          <Headphones
            className={cn(
              "shrink-0",
              size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
            )}
            aria-hidden="true"
          />
          <span className={cn("truncate font-bold", text)}>
            Đang nghe cùng {partnerName}
          </span>
        </span>
        <button
          type="button"
          onClick={() => void listen.end()}
          className={cn(
            "text-muted-foreground hover:text-destructive shrink-0 rounded-full px-2 py-1.5 font-semibold transition-colors",
            text,
          )}
        >
          Dừng
        </button>
      </div>
    );
  }
  if (listen.waiting) {
    return (
      <div className="pointer-events-auto flex w-full items-center gap-1.5">
        <span
          className={cn(
            "bg-muted text-muted-foreground flex min-w-0 flex-1 items-center gap-1.5 rounded-full",
            pad,
          )}
        >
          <Loader2
            className={cn(
              "shrink-0 animate-spin",
              size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
            )}
            aria-hidden="true"
          />
          <span className={cn("truncate font-semibold", text)}>
            Đang chờ {partnerName} trả lời…
          </span>
        </span>
        <button
          type="button"
          onClick={() => void listen.end()}
          className={cn(
            "text-muted-foreground hover:text-destructive shrink-0 rounded-full px-2 py-1.5 font-semibold transition-colors",
            text,
          )}
        >
          Huỷ
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={invite}
      disabled={listen.isBusy}
      aria-label={`Rủ ${partnerName} nghe cùng`}
      className={cn(
        "bg-accent-soft text-accent hover:bg-accent pointer-events-auto flex w-full items-center justify-center gap-1.5 rounded-full font-bold transition-colors hover:text-white disabled:opacity-60",
        text,
        size === "sm" ? "py-1.5" : "px-4 py-2",
      )}
    >
      <Headphones
        className={cn("shrink-0", size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")}
        aria-hidden="true"
      />
      <span className="truncate">Rủ {partnerName} nghe cùng</span>
    </button>
  );
}
