"use client";

/**
 * Last-resort boundary: catches throws in the root layout itself, which means
 * it REPLACES that layout — so it has to render its own <html> and <body>.
 *
 * Consequences that shape this file:
 *  - globals.css is imported here directly; the layout that normally loads it
 *    is exactly what failed.
 *  - the next/font CSS variables are not applied either, so body gets an
 *    explicit system font stack instead of relying on --font-sans-inter.
 *  - navigation uses a plain <a>: there is no app router chrome left to trust.
 */

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="vi">
      <body
        style={{
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <main className="bg-background text-foreground flex min-h-screen items-center justify-center px-4 py-16">
          <div className="border-border bg-card shadow-elev-1 flex w-full max-w-[420px] flex-col items-center gap-4 rounded-xl border p-6 text-center">
            <span
              className="bg-accent-soft text-accent flex h-16 w-16 items-center justify-center rounded-full text-2xl"
              aria-hidden="true"
            >
              ✳
            </span>

            <div className="space-y-1.5">
              <h1 className="text-h1 font-semibold">Ứng dụng vừa gặp sự cố</h1>
              <p className="text-muted-foreground text-sm">
                Tụi mình chưa mở được góc riêng của hai bạn lúc này. Dữ liệu vẫn an toàn — thử
                tải lại giúp nhé.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={reset}
                className="bg-accent text-accent-foreground hover:bg-accent-hover focus-visible:ring-ring/50 inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-medium shadow-sm outline-none transition-all active:scale-[.98] focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                Thử lại
              </button>
              <a
                href="/home"
                className="border-border bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-11 w-full items-center justify-center rounded-xl border text-sm font-medium shadow-sm outline-none transition-all active:scale-[.98] focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                Về Hôm nay
              </a>
            </div>

            {error.digest && (
              <p className="text-muted-foreground text-xs">
                Mã sự cố: <span className="font-mono">{error.digest}</span>
              </p>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
