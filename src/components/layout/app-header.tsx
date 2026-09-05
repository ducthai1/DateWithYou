"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Settings } from "lucide-react";
import { isPublicChrome } from "./nav-items";
import { MobileMoreMenu } from "./mobile-more-menu";
import { BrandMark } from "./brand-mark";
import { SyncButton } from "./sync-button";

// 40px tap target + focus ring, shared by every header action link.
const ACTION_CLASS = (active: boolean) =>
  "flex h-10 w-10 items-center justify-center rounded-lg transition-colors touch-manipulation " +
  "outline-none focus-visible:ring-2 focus-visible:ring-ring/50 " +
  (active
    ? "text-accent bg-accent-soft active:bg-accent/20"
    : "text-muted-foreground hover:bg-muted active:bg-muted");

/**
 * Mobile-only top bar (hidden on md+, where the sidebar carries the same
 * targets). Holds the four things that have no home in the six-slot bottom
 * bar: sync, the activity bell, the vault lock, and Settings.
 */
export function AppHeader() {
  const pathname = usePathname();
  if (isPublicChrome(pathname)) return null;

  return (
    <header data-app-chrome
      // z-30: the page band below pins with its top above the viewport, and that
      // overhang has to pass BEHIND this bar rather than over it.
      className="border-border bg-background/85 sticky top-0 z-40 flex shrink-0 items-center justify-between border-b px-4 py-2 backdrop-blur md:hidden">
      <Link
        href="/map"
        className="flex min-w-0 items-center gap-2 overflow-hidden text-lg font-semibold"
      >
        {/* Allowed to shrink, which is the opposite of what it used to do.
            Pinned at w-40 and shrink-0, the wordmark did not fit next to four
            40px actions on a 320px phone and was cut by 61px — 38% of it gone,
            on every screen in the app. The logo is object-contain, so a
            narrower box scales it down whole instead of slicing it; flex takes
            exactly the width it must and leaves it at 160px everywhere else. */}
        <BrandMark className="h-10 w-40 min-w-0" />
      </Link>
      {/* shrink-0: four 40px targets must stay tappable. */}
      <div className="flex shrink-0 items-center gap-1">
        <SyncButton mode="mobile" />
        {/* No bell here any more. This header is md:hidden — phones only — and
            the count now lives in the bottom bar, where the thumb already is.
            Two copies of the same number on one screen is worse than one. */}
        {/* Tìm kiếm out here, Bí mật moved into the sheet: one is reached
            mid-thought and wants a single tap, the other is a place you go on
            purpose and can afford two. */}
        <Link
          href="/search"
          aria-label="Tìm kiếm"
          className={ACTION_CLASS(pathname.startsWith("/search"))}
        >
          <Search className="h-5 w-5" />
        </Link>
        {/* Settings left the mobile bottom bar (six targets is already the
            limit at 390px), so this is now its only mobile entry point —
            without it the gear would be desktop-sidebar-only. */}
        <Link
          href="/settings"
          aria-label="Cài đặt"
          className={ACTION_CLASS(pathname.startsWith("/settings"))}
        >
          <Settings className="h-5 w-5" />
        </Link>
        {/* Everything the six-slot bar and these icons leave out. Without it
            "Đã đi" and "Tìm kiếm" were desktop-sidebar-only — present in the
            app, absent from every phone. */}
        <MobileMoreMenu className={ACTION_CLASS(false)} />
      </div>
    </header>
  );
}
