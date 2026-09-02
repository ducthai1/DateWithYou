"use client";

import { usePathname } from "next/navigation";
import { NAV_HIDDEN_ON } from "./nav-items";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";

export function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hidden = NAV_HIDDEN_ON.includes(pathname);
  const { isCollapsed, ready } = useSidebar();

  return (
    <div data-app-main className={cn(
      // Match the sidebar: skip the padding transition until the saved collapse
      // state is loaded, so content doesn't slide on first paint.
      ready && "transition-[padding] duration-300 ease-in-out",
      /*
       * A window-height frame, so a page can put its header outside whatever
       * scrolls.
       *
       * The window used to scroll, which left only one way to keep a header on
       * screen: stick it over the content. That is what produced the pale bar
       * across the top — a translucent full-bleed strip with the page sliding
       * blurrily beneath it. With the frame fixed here, a page header is simply
       * a row that does not scroll, and the content below owns its own scroll
       * box. Nothing overlaps anything.
       *
       * Marketing and auth routes keep the ordinary document scroll: they are
       * long pages with no app chrome and nothing to pin.
       */
      /*
       * `overflow-y-auto`, not `hidden`. The frame is a safety net, not a lid.
       *
       * With `hidden`, any page that did not happen to build its own scroll box
       * was simply cut off — /settings and /onboarding lost 1736px of content
       * with no way to reach it. A page that manages its own scrolling still
       * fits this box exactly and never scrolls it; a page that does not gets
       * scrolled here instead of being clipped away.
       *
       * The bottom-nav allowance is padding on the frame, so it is inside the
       * 100dvh (border-box) — a page filling the frame ends above the nav.
       *
       * 5rem, because the nav measures 76px at 390px wide (plus the safe-area
       * inset it adds for the home indicator, matched here). It was 4rem, which
       * was 12px short of covering it.
       *
       * ⚠️ This only clears the nav for a page that FITS the frame. A page that
       * overflows the `flex-1 min-h-0` content box instead — settings did — is
       * scrolled by this frame, and neither this padding nor a spacer element
       * lands after that overflow: both are laid out from the content box's own
       * height, which flex has already fixed, so they strand above the part
       * that scrolls. The fix for such a page is to scroll inside its own box,
       * the way PageShell does; then this padding does its job again.
       */
      !hidden && "flex h-[100dvh] flex-col overflow-y-auto",
      !hidden && "pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0",
      !hidden && (isCollapsed ? "md:pl-28" : "md:pl-72")
    )}>
      {children}
    </div>
  );
}
