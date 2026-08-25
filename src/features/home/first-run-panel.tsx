"use client";

// What a brand-new couple sees. Their space is genuinely empty, so instead of
// stacking five empty cards (which reads as "broken"), the screen turns into
// three warm invitations — each pointing at the feature that will fill it.

import Link from "next/link";
import { CalendarHeart, Images, Sparkles, ChevronRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

const STARTERS: { href: string; Icon: LucideIcon; title: string; sub: string }[] = [
  {
    href: "/settings",
    Icon: CalendarHeart,
    title: "Đặt ngày kỷ niệm",
    sub: "Để tụi mình bắt đầu đếm ngày bên nhau.",
  },
  {
    href: "/timeline",
    Icon: Images,
    title: "Thêm kỷ niệm đầu tiên",
    sub: "Một tấm ảnh với một dòng ngắn là đủ rồi.",
  },
  {
    href: "/calendar",
    Icon: Sparkles,
    title: "Lên kế hoạch cho hôm nay",
    sub: "Cà phê thôi cũng được, ghi vào cho vui.",
  },
];

/** `hasAnniversary` drops the "đặt ngày kỷ niệm" starter once it is set, so the
 *  panel never asks for something the couple already did. */
export function FirstRunPanel({ hasAnniversary = false }: { hasAnniversary?: boolean }) {
  const starters = hasAnniversary
    ? STARTERS.filter((s) => s.href !== "/settings")
    : STARTERS;

  return (
    <Card className="from-gradient-from/10 to-gradient-to/10 space-y-4 bg-gradient-to-br">
      <div className="space-y-1">
        <h2 className="text-h2 font-semibold">Chỗ này còn trống — mình bắt đầu nhé</h2>
        <p className="text-muted-foreground text-sm">
          Làm một trong ba việc dưới đây thôi, mai quay lại là màn hình này đã có gì đó dành cho
          tụi mình rồi.
        </p>
      </div>

      <ul className="space-y-2">
        {starters.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="border-border bg-card hover:bg-muted focus-visible:ring-ring/50 flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2.5 outline-none transition-colors focus-visible:ring-2"
            >
              <span
                className="bg-accent-soft flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                aria-hidden="true"
              >
                <s.Icon className="text-accent h-4 w-4" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{s.title}</span>
                <span className="text-muted-foreground block text-xs">{s.sub}</span>
              </span>
              <ChevronRight
                className="text-muted-foreground h-4 w-4 shrink-0"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
