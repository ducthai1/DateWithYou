"use client";

import { Loader2, LocateOff, SignalLow, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RerouteStatus } from "./use-reroute-manager";

/**
 * One line about the link, shown over the map while riding.
 *
 * One pill, not a stack: on a handlebar there is room to read a single short
 * sentence, and each state below already implies the ones under it. The
 * wording says what still WORKS as much as what broke — "GPS vẫn dẫn" is the
 * sentence that stops a rider pulling over to restart the app.
 */
export function NavConnectivityPill({
  isOffline,
  networkFlaky,
  gpsLost,
  reroute,
  reroutePending,
  className,
}: {
  isOffline: boolean;
  networkFlaky: boolean;
  gpsLost: boolean;
  reroute: RerouteStatus;
  reroutePending: boolean;
  className?: string;
}) {
  let tone: "red" | "amber" | "yellow" | "slate" | null = null;
  let icon: React.ReactNode = null;
  let text = "";

  if (isOffline && reroutePending) {
    tone = "red";
    icon = <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    text = "Mất mạng — đang lệch đường, sẽ vẽ lại ngay khi có mạng";
  } else if (isOffline) {
    tone = "slate";
    icon = <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    text = "Mất mạng — GPS vẫn dẫn, bản đồ dùng phần đã tải";
  } else if (reroute === "fetching") {
    tone = "yellow";
    icon = <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />;
    text = "Đang vẽ lại đường…";
  } else if (reroute === "retrying") {
    tone = "amber";
    icon = <SignalLow className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    text = "Mạng chập chờn — đang thử vẽ lại đường";
  } else if (networkFlaky) {
    tone = "amber";
    icon = <SignalLow className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    text = "Mạng chập chờn — vị trí người kia có thể trễ";
  } else if (gpsLost) {
    tone = "amber";
    icon = <LocateOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    text = "Mất định vị GPS";
  }

  if (!tone) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-nav-link={isOffline ? "offline" : reroute}
      className={cn(
        // Wraps to a second line on a narrow phone rather than cutting the
        // sentence off — the half that says what happens next is the useful half.
        "flex max-w-full items-center gap-2 rounded-2xl px-3 py-1.5 text-xs font-medium leading-snug text-white shadow-md animate-in fade-in slide-in-from-top-1",
        tone === "red" && "bg-red-500",
        tone === "amber" && "bg-amber-500",
        tone === "yellow" && "bg-yellow-500",
        tone === "slate" && "bg-slate-700/90",
        className,
      )}
    >
      {icon}
      <span>{text}</span>
    </div>
  );
}
