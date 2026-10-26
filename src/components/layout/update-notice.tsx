"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { RefreshCw, X } from "lucide-react";
import { isPublicChrome } from "@/components/layout/nav-items";

/**
 * "Có bản mới — tải lại."
 *
 * A deploy replaces the server at once; a page that is already open keeps the
 * JS it loaded, for as long as nobody reloads it — and on a phone, where the
 * app sits in the background for days, that is a long time. Most of the app
 * does not care. Watching together does: both phones speak a protocol to each
 * other through the server, and on 26/10 one phone still on the previous build
 * made the other person's player jump every 15 s.
 *
 * So the page asks the server which build it runs whenever the person comes
 * back to it, and every few minutes while they stay — one tiny request — and
 * offers a reload when the answer is not its own build. Offered, not forced:
 * reloading in the middle of a video is the person's call.
 */

const OWN_BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
/** How often an open, visible page asks, in ms. */
const CHECK_EVERY_MS = 5 * 60_000;

async function serverBuild(): Promise<string | null> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { build?: unknown };
    return typeof body.build === "string" ? body.build : null;
  } catch {
    // Offline or mid-deploy: no answer is not "a new build".
    return null;
  }
}

export function UpdateNotice() {
  const pathname = usePathname();
  // The marketing pages are read and left; nothing there talks to the other phone.
  const enabled = !isPublicChrome(pathname);
  const [newer, setNewer] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (newer) {
      /*
       * Already known. "Để sau" hides it until the person next comes back to
       * the app — dismissed for good, the page would stay on the old build
       * for as long as it stayed open, which is the very thing this is for.
       */
      const reoffer = () => {
        if (document.visibilityState === "visible") setDismissed(false);
      };
      document.addEventListener("visibilitychange", reoffer);
      return () => document.removeEventListener("visibilitychange", reoffer);
    }
    let cancelled = false;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const build = await serverBuild();
      if (!cancelled && build && build !== OWN_BUILD) setNewer(true);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    const t = setInterval(() => void check(), CHECK_EVERY_MS);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      clearInterval(t);
    };
  }, [enabled, newer]);

  // The offline bar sits in the same place and has the more urgent news.
  if (!newer || dismissed || navigator.onLine === false) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-update-notice
      className="pointer-events-auto fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[46] flex items-center gap-2 rounded-2xl border border-border bg-card/95 p-3 shadow-elev-float backdrop-blur-sm sm:inset-x-auto sm:left-1/2 sm:w-[26rem] sm:-translate-x-1/2"
    >
      <RefreshCw className="text-accent-ink h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Có bản mới của app</p>
        <p className="text-muted-foreground text-xs">
          Tải lại để dùng bản mới — xem cùng nhau cần cả hai máy cùng một bản.
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-ring/50 inline-flex h-10 shrink-0 items-center rounded-xl px-3 text-xs font-semibold outline-none transition-colors focus-visible:ring-2"
      >
        Tải lại
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Để sau"
        title="Để sau"
        className="text-muted-foreground hover:bg-muted focus-visible:ring-ring/50 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl outline-none transition-colors focus-visible:ring-2"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
