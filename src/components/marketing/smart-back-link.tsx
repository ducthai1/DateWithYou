"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { previousRoute, readRouteTrail } from "@/components/navigation/route-trail";
import { cn } from "@/lib/utils";

/**
 * "← Về Blog", "← Về trang chủ" — a back link that knows where you came from.
 *
 * Resolution order: the previous route this tab visited (RouteTrail), then a
 * same-origin referrer (a link opened from another tab of the site), then the
 * page's own fallback. When the target is the tab's previous history entry the
 * click uses history.back(), so the page you return to keeps its scroll
 * position instead of reloading at the top.
 *
 * Two palettes: `parchment` for the marketing pages (which hard-code their
 * colours) and `app` for anything drawn with the theme tokens, e.g. the blog.
 */
/*
 * Short names for the routes a public page is reached from. Each feature page
 * is named individually: a back link that says "Về Tính năng" while pointing
 * at /hom-nay-an-gi is worse than no label, and this is the case that happens
 * most (the feature pages link to each other under "Xem thêm").
 */
const NAMES: Record<string, string> = {
  "/": "Về trang chủ",
  "/blog": "Về Blog",
  "/blog/tim-kiem": "Về tìm kiếm",
  "/tinh-nang": "Về Tính năng",
  "/hom-nay-an-gi": "Về Hôm nay ăn gì",
  "/luu-dia-diem-da-di": "Về Lưu địa điểm",
  "/nhat-ky-du-lich": "Về Nhật ký du lịch",
  "/thu-gui-tuong-lai": "Về Thư gửi tương lai",
  "/library": "Về Bộ sưu tập",
  "/sign-in": "Về đăng nhập",
  "/sign-up": "Về đăng ký",
};
const APP_PREFIXES = ["/home", "/map", "/calendar", "/timeline", "/trips", "/activity", "/library", "/rides", "/search", "/settings", "/wheel", "/vault", "/admin"];

function labelFor(href: string): string {
  const path = href.split(/[?#]/)[0];
  if (NAMES[path]) return NAMES[path];
  if (path.startsWith("/blog/danh-muc/")) return "Về danh mục";
  if (path.startsWith("/blog/")) return "Về bài viết";
  if (APP_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) return "Về ứng dụng";
  return "Quay lại";
}

export function SmartBackLink({
  fallback,
  tone = "parchment",
  className,
}: {
  fallback: string;
  tone?: "parchment" | "app";
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [target, setTarget] = useState<{ href: string; viaHistory: boolean }>({ href: fallback, viaHistory: false });

  useEffect(() => {
    const prev = previousRoute(pathname);
    if (prev) {
      // Previous entry of the trail AND the tab has somewhere to go back to.
      const trail = readRouteTrail();
      const isLastStep = trail.length >= 2 && trail[trail.length - 1] === pathname && trail[trail.length - 2] === prev;
      setTarget({ href: prev, viaHistory: isLastStep && window.history.length > 1 });
      return;
    }
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      if (ref && ref.origin === window.location.origin && ref.pathname !== pathname) {
        setTarget({ href: ref.pathname + ref.search, viaHistory: false });
      }
    } catch {
      /* keep the fallback */
    }
  }, [pathname]);

  const label = labelFor(target.href);
  return (
    <a
      href={target.href}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // let "open in new tab" work
        e.preventDefault();
        if (target.viaHistory) router.back();
        else router.push(target.href);
      }}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-4 text-sm font-medium shadow-sm backdrop-blur-sm transition-all hover:-translate-x-0.5",
        tone === "parchment"
          ? "border-[#d8cfc1]/80 bg-white/60 text-[#6f675d] hover:border-[#c2693f]/40 hover:text-[#a8542f]"
          : "border-border bg-card/90 text-muted-foreground hover:border-accent/40 hover:text-accent",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
          tone === "parchment"
            ? "bg-[#c2693f]/10 text-[#a8542f] group-hover:bg-[#c2693f] group-hover:text-white"
            : "bg-accent-soft text-accent group-hover:bg-accent group-hover:text-white",
        )}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </span>
      {label}
    </a>
  );
}
