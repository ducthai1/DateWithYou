"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, HeartHandshake } from "lucide-react";
import { NAV_HIDDEN_ON } from "./nav-items";

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
      <Link href="/calendar" className="flex items-center gap-1.5 font-serif text-lg font-semibold">
        <HeartHandshake className="h-5 w-5 shrink-0 text-accent" />
        Vivu No Plan
      </Link>
      <Link
        href="/settings"
        aria-label="Cài đặt"
        className={
          "rounded-lg p-1.5 transition-colors " +
          (pathname.startsWith("/settings")
            ? "text-accent bg-accent-soft"
            : "text-muted-foreground hover:bg-muted")
        }
      >
        <Settings className="h-5 w-5" />
      </Link>
    </header>
  );
}
