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
    <div className={cn(
      // Match the sidebar: skip the padding transition until the saved collapse
      // state is loaded, so content doesn't slide on first paint.
      ready && "transition-[padding] duration-300 ease-in-out",
      // Reserve the bottom-nav height PLUS the home-indicator inset so the last
      // row of content never hides behind the nav on notched phones. Desktop
      // drops the bottom pad and offsets for the sidebar (width depends on collapse).
      !hidden && "pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0",
      !hidden && (isCollapsed ? "md:pl-20" : "md:pl-64")
    )}>
      {children}
    </div>
  );
}
