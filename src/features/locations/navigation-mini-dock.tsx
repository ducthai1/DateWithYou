"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Navigation, X } from "lucide-react";
import { useNavigation } from "./navigation-context";
import { NAV_HIDDEN_ON } from "@/components/layout/nav-items";
import { useSidebar } from "@/components/layout/sidebar-context";
import { fmtDistance, fmtDuration } from "./format-journey";
import { cn } from "@/lib/utils";

/**
 * The journey, shrunk into a corner, while you are somewhere else in the app.
 *
 * Google Maps does this at the operating-system level: leave the app and a
 * floating window follows you across every other app. A web page cannot do
 * that, and the near-misses are worse than not trying. Automatic
 * picture-in-picture needs an active camera or microphone capture, which this
 * app has no business asking for. Document picture-in-picture is desktop-only.
 * And drawing the map into a video to float it would freeze the moment the tab
 * hides, because `requestAnimationFrame` stops in a hidden page — a mini-map
 * frozen on a position you have already walked away from is worse than none.
 *
 * So this covers the half that is genuinely reachable: leaving the map *page*.
 * Opening the wheel or a saved place mid-journey used to unmount the whole
 * navigation hook, which stopped the GPS watch and released the wake lock. Now
 * that state lives above the router, and this is its window — where you are,
 * how far is left, and one tap back to the full map.
 */

// Loaded on demand: a second WebGL context should not exist in every page's
// bundle for a state most sessions never enter.
const LocationMapView = dynamic(
  () => import("./location-mapview").then((m) => m.LocationMapView),
  { ssr: false },
);

/** The dock belongs to every page except the one it is a shortcut back to. */
const MAP_ROUTE = "/map";

export function NavigationMiniDock() {
  const nav = useNavigation();
  const pathname = usePathname();
  const { isCollapsed } = useSidebar();
  const [dismissed, setDismissed] = useState(false);
  const wasNavigating = useRef(false);

  // A dismissal applies to the journey it was made during, not to every journey
  // after it — otherwise hiding it once hides it for good.
  useEffect(() => {
    if (nav.isNavigating && !wasNavigating.current) setDismissed(false);
    wasNavigating.current = nav.isNavigating;
  }, [nav.isNavigating]);

  // Also stays away from the routes that hide the app chrome — marketing and
  // auth pages. Floating a journey over the landing page would be a bug, not a
  // convenience, and there is no bottom nav there to sit above either.
  if (
    !nav.isNavigating ||
    pathname === MAP_ROUTE ||
    dismissed ||
    NAV_HIDDEN_ON.includes(pathname)
  ) {
    return null;
  }

  const distance = fmtDistance(nav.remainingMeters);
  const duration = fmtDuration(nav.remainingSeconds);

  return (
    <div
      className={cn(
        // Clears the bottom nav plus the home indicator. Measured, not guessed:
        // the nav renders 75px tall, so the 4.5rem this started at put the dock
        // 4px underneath it. 5.5rem leaves a real gap.
        "fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] left-3 z-40",
        // Desktop tracks the sidebar, which is why this reads its collapse state
        // rather than assuming a width — MainWrapper pads md:pl-28 / md:pl-72.
        "md:bottom-6",
        isCollapsed ? "md:left-[7.5rem]" : "md:left-[18.5rem]",
      )}
    >
      <div className="relative w-[168px] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
        <Link
          href={MAP_ROUTE}
          aria-label={`Quay lại bản đồ. Còn ${distance}, khoảng ${duration}`}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* Clipped here, not just at the card's rounded edge. MapLibre draws
              markers in a container that overflows the canvas on purpose, so
              the live-position marker painted straight over the distance line
              below and left the dock looking like it had no text at all.

              The marker is left at full size on purpose. It is large for a
              104px map, but MapLibre positions markers with a `transform`, and
              a CSS scale replaces that transform rather than composing with it
              — the puck detaches from the position it is meant to mark. */}
          <div className="pointer-events-none relative h-[104px] overflow-hidden">
            <LocationMapView
              pins={[]}
              userGeo={nav.userGeo}
              followGeo={nav.userGeo}
              heading={nav.heading}
              traveled={nav.traveled}
              partnerLocation={nav.partnerLocation}
              attribution={false}
              // `min-h-0` is doing real work: the map carries a
              // `min-h-[280px]` floor for its full-page use, and a minimum
              // height is a different property from height, so `h-full` alone
              // left a 278px canvas inside this 104px box — the live-position
              // marker landed 36px below anything visible. twMerge resolves the
              // two `min-h` classes and this one wins. The border and corners
              // go too; the card already provides both.
              className="h-full w-full min-h-0 rounded-none border-0 shadow-none"
            />
            {/* The map is a picture here, not a control — every gesture on the
                dock should mean "take me back", not "pan this 168px map".

                MapLibre's own credit is off because at this size it covers the
                map completely, so the credit is printed here instead: small,
                but present and legible, which is what the licence asks for. */}
            <span className="absolute bottom-0 right-0 bg-black/45 px-1 text-[8px] leading-[1.4] text-white/90">
              © OpenStreetMap
            </span>
          </div>

          <div className="flex items-center gap-2 px-2.5 py-2">
            <Navigation
              className={cn(
                "h-4 w-4 shrink-0",
                nav.gpsLost ? "text-muted-foreground" : "text-[var(--accent)]",
              )}
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold leading-tight tabular-nums">
                {nav.gpsLost ? "Mất tín hiệu" : distance}
              </span>
              <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                {nav.gpsLost ? "đang tìm lại vị trí" : `còn khoảng ${duration}`}
              </span>
            </span>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Ẩn bản đồ thu nhỏ"
          className="absolute right-1 top-1 rounded-full bg-black/45 p-1 text-white backdrop-blur transition-colors hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      {/* Hiding the dock must not read as "the journey stopped". */}
      <span className="sr-only" role="status" aria-live="polite">
        {`Đang dẫn đường, còn ${distance}, khoảng ${duration}`}
      </span>
    </div>
  );
}
