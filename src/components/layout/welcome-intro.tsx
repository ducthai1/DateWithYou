"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { BrandMark } from "./brand-mark";
import { NAV_ITEMS, isPublicChrome, isAdminRoute } from "./nav-items";

const SEEN_KEY = "dwy:welcomeSeen";

// One-line "what is this tab" for the first-run glossary, keyed by href so it
// stays in sync with NAV_ITEMS (icons + labels reused from there).
const TAB_BLURB: Record<string, string> = {
  "/map": "Lưu địa điểm yêu thích & rủ nhau cùng đi, chỉ đường trực tiếp.",
  "/library": "Công thức nấu ăn, video món ngon, trò chơi cho cả hai.",
  "/calendar": "Lên kế hoạch đi chơi & đếm ngược ngày đặc biệt.",
  "/timeline": "Lưu ảnh, cảm xúc, nhạc/video những khoảnh khắc đã qua.",
  "/vault": "Dự định, wishlist, phiếu thưởng & hộp thời gian riêng của hai bạn.",
  "/home": "Mở app là thấy ngay: hôm nay có gì, sắp tới ngày nào, kỷ niệm năm ngoái.",
  "/trips": "Lịch trình từng ngày, ngân sách và checklist đồ cần mang.",
  "/search": "Lục lại kỷ niệm, quán, công thức — gõ không dấu vẫn ra.",
  "/activity": "Người kia vừa thêm gì vào không gian chung.",
  "/settings": "Ngày kỷ niệm, biệt danh, màu chủ đề và mã mời.",
};

/**
 * First-run orientation. Shows once (localStorage flag) on the first visit to an
 * app screen, explaining what the app is and what each nav destination holds —
 * so a new couple isn't dropped into an empty calendar with no context. Hidden
 * on auth/onboarding/landing, and never shown again after dismissal.
 */
export function WelcomeIntro() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isPublicChrome(pathname) || isAdminRoute(pathname)) return;
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      /* localStorage unavailable (private mode) — just skip the intro */
    }
  }, [pathname]);

  function dismiss() {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  if (!open) return null;

  return (
    <Modal open onClose={dismiss} className="max-w-lg">
      {/*
        Three bands, and only the middle one scrolls.

        The whole card used to be one scrolling box, so on a short phone the
        "Bắt đầu" button sat below the fold behind ten list rows — the thing
        the screen exists to be pressed was the one thing not on it. Header
        and footer are fixed; the glossary scrolls between them; the footer
        clears the home indicator. On a wider screen the ten rows go two
        abreast, which halves the height and usually removes the scroll.
      */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Kept short on purpose: on a 568px-tall phone this header was
            taking almost half the screen before the first glossary row, so
            two rows showed and the rest had to be scrolled for. */}
        <div className="shrink-0 space-y-1 px-6 pt-5 pb-2 text-center">
          <span className="bg-accent-soft text-accent mx-auto flex h-9 w-9 items-center justify-center rounded-xl">
            <BrandMark variant="icon" className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold [font-family:var(--font-display)] sm:text-2xl">
            Chào mừng tới Vivu No Plan
          </h2>
          <p className="text-muted-foreground mx-auto max-w-sm text-xs sm:text-sm">
            Lên kế hoạch, lưu kỷ niệm, tạo bất ngờ cho người bạn rủ vào.
          </p>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto px-6 py-2 [overscroll-behavior:contain] sm:grid sm:grid-cols-2 sm:gap-x-5">
          {NAV_ITEMS.map((it) => {
            const Icon = it.Icon;
            return (
              <li key={it.href} className="flex items-start gap-3 py-1.5">
                <span className="bg-muted text-accent mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{it.label}</p>
                  <p className="text-muted-foreground text-xs leading-snug">{TAB_BLURB[it.href]}</p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="border-border bg-card shrink-0 border-t px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <Button onClick={dismiss} className="w-full">
            Bắt đầu nào 💕
          </Button>
        </div>
      </div>
    </Modal>
  );
}
