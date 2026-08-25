"use client";

/**
 * Route-level error boundary.
 *
 * Without this file any render throw inside a route drops a Vietnamese-speaking
 * couple onto Next's default English error screen. The raw error is logged to
 * the console for us and never shown to them — only the opaque `digest`, which
 * is what lets a report be matched to a server log.
 */

import { useEffect } from "react";
import Link from "next/link";
import { HeartCrack, RefreshCw, Home } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Developer-facing only. Nothing here reaches the rendered page.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-4 px-4 py-16 text-center">
      <span
        className="bg-accent-soft flex h-16 w-16 items-center justify-center rounded-full"
        aria-hidden="true"
      >
        <HeartCrack className="text-accent h-7 w-7" strokeWidth={1.6} />
      </span>

      <div className="space-y-1.5">
        <h1 className="text-h1 font-semibold">Ối, có gì đó trục trặc</h1>
        <p className="text-muted-foreground text-sm">
          Không phải do bạn đâu. Mọi thứ của tụi mình vẫn còn nguyên — thử tải lại một lần nữa
          xem sao nhé.
        </p>
      </div>

      <div className="flex w-full flex-col gap-2 pt-1 sm:w-auto sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="bg-accent text-accent-foreground hover:bg-accent-hover focus-visible:ring-ring/50 inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium shadow-sm outline-none transition-all active:scale-[.98] focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Thử lại
        </button>
        <Link
          href="/home"
          className="border-border bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-medium shadow-sm outline-none transition-all active:scale-[.98] focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          Về Hôm nay
        </Link>
      </div>

      {error.digest && (
        <p className="text-muted-foreground pt-2 text-xs">
          Mã sự cố: <span className="font-mono">{error.digest}</span>
        </p>
      )}
    </div>
  );
}
