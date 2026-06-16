"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Settings, HeartHandshake } from "lucide-react";
import { NAV_ITEMS, NAV_HIDDEN_ON } from "./nav-items";
import { useSidebar } from "./sidebar-context";
import { cn } from "@/lib/utils";

/** Desktop-only sidebar (md+). Mobile uses the bottom nav instead. */
export function SideNav() {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar, ready } = useSidebar();

  if (NAV_HIDDEN_ON.includes(pathname)) return null;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-20 hidden flex-col justify-between border-r border-border bg-card shadow-[4px_0_24px_rgba(0,0,0,0.02)] md:flex",
        // Only animate width once the saved state is loaded — avoids the
        // expanded→collapsed slide on first paint.
        ready && "transition-[width] duration-300 ease-in-out",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      <div className="flex flex-col gap-2 p-4">
        <Link
          href="/map"
          className={cn(
            "mb-4 flex items-center font-serif text-xl font-semibold transition-all duration-300",
            isCollapsed ? "justify-center px-0" : "justify-start px-2"
          )}
        >
          <HeartHandshake className="h-6 w-6 shrink-0 text-accent" />
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap transition-all duration-300",
              isCollapsed ? "w-0 opacity-0 ml-0" : "w-auto opacity-100 ml-2"
            )}
          >
            Vivu No Plan
          </span>
        </Link>
        
        <div className="flex flex-col gap-1">
          {NAV_ITEMS.map((it) => {
            const active = pathname.startsWith(it.href);
            const Icon = it.Icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
                  active
                    ? "bg-accent-soft font-medium text-accent shadow-sm"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                  isCollapsed && "justify-center px-0"
                )}
                title={isCollapsed ? it.label : undefined}
              >
                <Icon className={cn("shrink-0", isCollapsed ? "h-[22px] w-[22px]" : "h-5 w-5")} />
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

      <div className="flex flex-col gap-1 p-4">
        <Link
          href="/settings"
          className={cn(
            "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
            pathname.startsWith("/settings")
              ? "bg-accent-soft font-medium text-accent shadow-sm"
              : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            isCollapsed && "justify-center px-0",
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
        <button
          onClick={toggleSidebar}
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
