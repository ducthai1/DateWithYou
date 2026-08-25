import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";

export const metadata: Metadata = {
  title: "Không tìm thấy",
  robots: { index: false, follow: false },
};

/**
 * Warm 404. Rendered inside the root layout, so it keeps the app chrome and the
 * couple's accent theme — the only thing that changes is the message.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-4 px-4 py-16 text-center">
      <span
        className="bg-accent-soft flex h-16 w-16 items-center justify-center rounded-full"
        aria-hidden="true"
      >
        <Compass className="text-accent h-7 w-7" strokeWidth={1.6} />
      </span>

      <div className="space-y-1.5">
        <h1 className="text-h1 font-semibold">Lạc đường mất rồi</h1>
        <p className="text-muted-foreground text-sm">
          Trang này không có ở đây. Có thể đường dẫn đã cũ, hoặc tụi mình vừa dọn nó đi chỗ khác.
        </p>
      </div>

      <div className="flex w-full flex-col gap-2 pt-1 sm:w-auto sm:flex-row">
        <Link
          href="/home"
          className="bg-accent text-accent-foreground hover:bg-accent-hover focus-visible:ring-ring/50 inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-medium shadow-sm outline-none transition-all active:scale-[.98] focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          Về Hôm nay
        </Link>
        <Link
          href="/timeline"
          className="border-border bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-11 items-center justify-center rounded-xl border px-5 text-sm font-medium shadow-sm outline-none transition-all active:scale-[.98] focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          Xem kỷ niệm
        </Link>
      </div>
    </div>
  );
}
