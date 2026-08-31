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
      !hidden && "flex h-[100dvh] flex-col overflow-hidden",
      // The bottom nav is fixed and outside this box, so the space it needs is
      // reserved by whatever scrolls, not by padding out here.
      !hidden && (isCollapsed ? "md:pl-28" : "md:pl-72")
    )}>
      {children}
    </div>
  );
}
