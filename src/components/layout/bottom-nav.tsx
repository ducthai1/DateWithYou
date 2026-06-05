"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/map", label: "Bản đồ", icon: "🗺️" },
  { href: "/wheel", label: "Quay", icon: "🎯" },
  { href: "/timeline", label: "Kỷ niệm", icon: "📸" },
  { href: "/vault", label: "Bí mật", icon: "🔒" },
  { href: "/settings", label: "Cài đặt", icon: "⚙️" },
];

// Hidden on auth / landing / onboarding routes.
const HIDDEN_ON = ["/", "/sign-in", "/sign-up", "/onboarding"];

export function BottomNav() {
  const pathname = usePathname();
  if (HIDDEN_ON.includes(pathname)) return null;

  return (
    <nav className="border-border bg-background/90 fixed inset-x-0 bottom-0 z-20 flex justify-around border-t pb-[env(safe-area-inset-bottom)] backdrop-blur">
      {ITEMS.map((it) => {
        const active = pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
              active ? "text-accent" : "text-muted-foreground"
            }`}
          >
            <span className="text-lg">{it.icon}</span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
