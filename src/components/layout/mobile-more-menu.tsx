"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

/**
 * The routes a phone could not reach at all.
 *
 * The bottom bar holds six destinations, which is what fits at 390px, and the
 * rest carry `mobileHidden`. That flag was written as "still reachable from the
 * top bar", and for Settings it was — the header links it directly. For "Đã đi"
 * and "Tìm kiếm" it was simply not true: both existed as tabs in the desktop
 * sidebar and had no entry point on a phone anywhere. A whole screen of rides
 * already taken was unreachable on the device the app is mostly used on.
 *
 * So this lists whatever is hidden from the bar and not already linked beside
 * it, read from NAV_ITEMS rather than typed out — a route added with
 * `mobileHidden` from now on appears here on its own instead of quietly going
 * missing again.
 */

/** Hrefs the header already links directly, so they are not repeated here. */
const IN_HEADER = ["/settings"];

export function MobileMoreMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const items = NAV_ITEMS.filter((it) => it.mobileHidden && !IN_HEADER.includes(it.href));
  if (items.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Thêm mục khác"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={className}
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <h2 className="text-foreground mb-1 text-base font-semibold">Mục khác</h2>
        <p className="text-muted-foreground mb-3 text-xs">
          Những phần không nằm trong thanh dưới.
        </p>
        <ul className="space-y-1">
          {items.map(({ href, label, Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    // min-h-12: a list in a sheet is tapped with a thumb, and
                    // these sit close together.
                    "flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent-soft text-accent"
                      : "text-foreground hover:bg-muted active:bg-muted",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </>
  );
}
