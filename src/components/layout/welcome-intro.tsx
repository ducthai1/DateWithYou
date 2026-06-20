"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HeartHandshake } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { NAV_ITEMS, NAV_HIDDEN_ON } from "./nav-items";

const SEEN_KEY = "dwy:welcomeSeen";

// One-line "what is this tab" for the first-run glossary, keyed by href so it
// stays in sync with NAV_ITEMS (icons + labels reused from there).
const TAB_BLURB: Record<string, string> = {
  "/map": "Lưu địa điểm yêu thích & rủ nhau cùng đi, chỉ đường trực tiếp.",
  "/library": "Công thức nấu ăn, video món ngon, trò chơi cho hai đứa.",
  "/calendar": "Lên kế hoạch hẹn hò & đếm ngược ngày đặc biệt.",
  "/timeline": "Lưu ảnh, cảm xúc, nhạc/video những khoảnh khắc đã qua.",
  "/vault": "Dự định, wishlist, phiếu thưởng & hộp thời gian riêng của hai bạn.",
};

/**
 * First-run orientation. Shows once (localStorage flag) on the first visit to an
 * app screen, explaining what the app is and what each of the 5 tabs holds —
 * so a new couple isn't dropped into an empty calendar with no context. Hidden
 * on auth/onboarding/landing, and never shown again after dismissal.
 */
export function WelcomeIntro() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (NAV_HIDDEN_ON.includes(pathname)) return;
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
    <Modal open onClose={dismiss} className="max-w-md">
      <div className="space-y-5 p-6">
        <div className="space-y-2 text-center">
          <span className="bg-accent-soft text-accent mx-auto flex h-12 w-12 items-center justify-center rounded-2xl">
            <HeartHandshake className="h-6 w-6" />
          </span>
          <h2
            className="text-2xl font-semibold [font-family:var(--font-display)]"
          >
            Chào mừng tới Vivu No Plan
          </h2>
          <p className="text-muted-foreground text-sm">
            Không gian chung của hai đứa — cùng lên kế hoạch, lưu kỷ niệm và tạo bất ngờ cho nhau.
          </p>
        </div>

        <ul className="space-y-2.5">
          {NAV_ITEMS.map((it) => {
            const Icon = it.Icon;
            return (
              <li key={it.href} className="flex items-start gap-3">
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

        <Button onClick={dismiss} className="w-full">
          Bắt đầu nào 💕
        </Button>
      </div>
    </Modal>
  );
}
