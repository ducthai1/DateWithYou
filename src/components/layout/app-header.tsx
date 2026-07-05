"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { NAV_HIDDEN_ON } from "./nav-items";
import { BrandMark } from "./brand-mark";
import { SyncButton } from "./sync-button";

/**
 * Mobile-only top bar. The desktop sidebar already exposes the app title and
 * Settings, so this is hidden on md+. It is the mobile entry point to Settings
 * now that the gear no longer lives in the bottom nav.
 */
export function AppHeader() {
  const pathname = usePathname();
  if (NAV_HIDDEN_ON.includes(pathname)) return null;

  return (
    <header className="border-border bg-background/85 sticky top-0 z-20 flex items-center justify-between border-b px-4 py-2.5 backdrop-blur md:hidden">
      <Link href="/calendar" className="flex items-center gap-2 text-lg font-semibold">
        <BrandMark className="h-8 w-32 shrink-0" />
      </Link>
      <div className="flex items-center gap-1">
        <SyncButton mode="mobile" />
        <Link
          href="/vault"
          aria-label="Bí mật"
          className={
            "flex h-10 w-10 items-center justify-center rounded-lg transition-colors touch-manipulation " +
            (pathname.startsWith("/vault")
              ? "text-accent bg-accent-soft active:bg-accent/20"
              : "text-muted-foreground hover:bg-muted active:bg-muted")
          }
        >
          <Lock className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}
