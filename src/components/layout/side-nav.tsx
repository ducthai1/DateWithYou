"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Lock, Dices, Settings, Newspaper } from "lucide-react";
import { NAV_ITEMS, isPublicChrome } from "./nav-items";
import { trpc } from "@/lib/trpc";
import { UnreadBadge, unreadLabel, useUnreadActivity } from "@/features/activity/unread-badge";
import { BrandMark } from "./brand-mark";
import { useSidebar } from "./sidebar-context";
import { SyncButton } from "./sync-button";
import { cn } from "@/lib/utils";

/** Desktop-only sidebar (md+). Mobile uses the bottom nav instead. */
export function SideNav() {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar, ready } = useSidebar();
  const unreadActivity = useUnreadActivity();
  const isAdmin =
    trpc.blog.amIAdmin.useQuery(undefined, { enabled: !isPublicChrome(pathname), retry: false }).data ?? false;

  if (isPublicChrome(pathname)) return null;

  return (
    <aside
      data-app-chrome
      className={cn(
        /*
          overflow-hidden and a scrollable list, because this box has a fixed
          height and had neither.

          inset-y-4 makes the sidebar exactly as tall as the window less 32px,
          and justify-between then pushed the two blocks apart with nothing to
          absorb the surplus. A logo, ten links and three footer rows need
          ~644px; at 150% browser zoom the window gives 568px, so ~76px of nav
          simply painted outside the rounded card. Nothing overflowed the page,
          which is why every sideways check missed it for so long.
        */
        // blur-md, not blur-xl, and a more opaque fill to make up the difference.
        // A 24px backdrop-filter over this area is the costliest layer the app
        // paints, and it is re-sampled every frame against a fixed full-window
        // picture — the combination that takes out the GPU process on older
        // integrated graphics.
        "fixed inset-y-4 left-4 z-20 hidden flex-col justify-between rounded-2xl border border-white/40 bg-white/85 backdrop-blur-md shadow-elev-2 md:flex",
        // Only animate width once the saved state is loaded — avoids the
        // expanded→collapsed slide on first paint.
        ready && "transition-[width] duration-300 ease-in-out",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-4 short:gap-1 short:p-3">
        <Link
          href="/map"
          className={cn(
            "mb-4 flex items-center transition-all duration-300 short:mb-1",
            isCollapsed ? "justify-center px-0" : "justify-center"
          )}
        >
          <BrandMark className={cn(
            "shrink-0 transition-all duration-300",
            // Smaller when the window is short — the logo is the cheapest
            // vertical space in here to give back.
            isCollapsed ? "h-10 w-12 short:h-8 short:w-10" : "h-14 w-44 short:h-10 short:w-32"
          )} />
        </Link>
        
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-1 py-1 [&>*]:scroll-my-2">
          {/* We explicitly define the desktop top items here because mobile bottom nav
              swapped Vault and Settings, but desktop wants Vault in the top section
              and Settings in the bottom section. */}
          {[
            // Re-order for desktop so /map is at the top, without affecting
            // the mobile bottom nav where it needs to remain physically in the center.
            ...NAV_ITEMS.filter((it) => it.href !== "/settings").sort((a, b) =>
              a.href === "/map" ? -1 : b.href === "/map" ? 1 : 0
            ),
            { href: "/wheel", label: "Vòng quay", Icon: Dices },
            { href: "/vault", label: "Bí mật", Icon: Lock },
          ].map((it) => {
            const active = pathname.startsWith(it.href);
            const Icon = it.Icon;
            // Only Hoạt động carries a count; everything else passes 0 and the
            // badge renders nothing.
            const unread = it.href === "/activity" ? unreadActivity : 0;
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-label={unread > 0 ? unreadLabel(it.label, unread) : undefined}
                className={cn(
                  "group flex shrink-0 items-center rounded-xl px-3 py-2.5 text-sm transition-all duration-200 short:py-1.5",
                  active
                    ? "bg-accent-soft font-medium text-accent shadow-sm"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                  // No gap when collapsed: the zero-width label still counts as a
                  // flex item, so a gap would shove the icon off-centre.
                  isCollapsed ? "justify-center px-0" : "gap-3"
                )}
                title={isCollapsed ? it.label : undefined}
              >
                {/* The icon gets a positioning context of its own so the badge
                    can hang off its corner whether the rail is open or
                    collapsed — anchoring to the row instead would put the
                    number beside the label in one state and nowhere near the
                    icon in the other. */}
                <span className="relative flex shrink-0">
                  <Icon className={cn("shrink-0", isCollapsed ? "h-[22px] w-[22px]" : "h-5 w-5")} />
                  <UnreadBadge count={unread} className="absolute -right-2 -top-1.5" />
                </span>
                <span
                  className={cn(
                    "overflow-hidden whitespace-nowrap transition-all duration-300",
                    isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                  )}
                >
                  {it.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1 p-4 short:p-3">
        {isAdmin && (
          <Link
            href="/admin/blog"
            className={cn(
              "group flex shrink-0 items-center rounded-xl px-3 py-2.5 text-sm transition-all duration-200 short:py-1.5",
              pathname.startsWith("/admin")
                ? "bg-accent-soft font-medium text-accent shadow-sm"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              isCollapsed ? "justify-center px-0" : "gap-3",
            )}
            title={isCollapsed ? "Quản lý Blog" : undefined}
          >
            <Newspaper className={cn("shrink-0", isCollapsed ? "h-[22px] w-[22px]" : "h-5 w-5")} />
            <span
              className={cn(
                "overflow-hidden whitespace-nowrap transition-all duration-300",
                isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100",
              )}
            >
              Quản lý Blog
            </span>
          </Link>
        )}
        <Link
          href="/settings"
          className={cn(
            "group flex shrink-0 items-center rounded-xl px-3 py-2.5 text-sm transition-all duration-200 short:py-1.5",
            pathname.startsWith("/settings")
              ? "bg-accent-soft font-medium text-accent shadow-sm"
              : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            isCollapsed ? "justify-center px-0" : "gap-3",
          )}
          title={isCollapsed ? "Cài đặt" : undefined}
        >
          <Settings className={cn("shrink-0", isCollapsed ? "h-[22px] w-[22px]" : "h-5 w-5")} />
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap transition-all duration-300",
              isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100",
            )}
          >
            Cài đặt
          </span>
        </Link>
        <SyncButton mode="desktop" isCollapsed={isCollapsed} />
        <button
          onClick={toggleSidebar}
          aria-label={isCollapsed ? "Phóng to thanh bên" : "Thu gọn thanh bên"}
          className={cn(
            "flex h-10 items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground outline-none",
            isCollapsed ? "w-full justify-center" : "w-full px-3 gap-3"
          )}
          title={isCollapsed ? "Phóng to" : "Thu gọn"}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-5 w-5 shrink-0" />
          ) : (
            <PanelLeftClose className="h-5 w-5 shrink-0" />
          )}
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap text-sm font-medium transition-all duration-300",
              isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            )}
          >
            Thu gọn
          </span>
        </button>
      </div>
    </aside>
  );
}
