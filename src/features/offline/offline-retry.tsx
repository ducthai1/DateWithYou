"use client";

import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";

/**
 * Nút bấm lại của trang offline, cộng với việc tự đi tiếp khi có mạng.
 *
 * Tách khỏi trang vì trang phải là server component tĩnh để service worker
 * giữ được bản HTML dùng khi không có mạng.
 */
export function OfflineRetry() {
  const [trying, setTrying] = useState(false);

  /*
   * Có mạng lại thì tự quay về, không bắt người ta ngồi bấm.
   * `location.reload()` chứ không phải router: trang này được service worker
   * đưa ra thay cho một URL khác, nên thứ cần làm là xin lại chính URL đó.
   */
  useEffect(() => {
    const back = () => window.location.reload();
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
  }, []);

  return (
    <div className="flex w-full flex-col gap-2 pt-1 sm:w-auto sm:flex-row">
      <button
        type="button"
        onClick={() => {
          setTrying(true);
          window.location.reload();
        }}
        disabled={trying}
        className="bg-accent text-accent-foreground hover:bg-accent-hover focus-visible:ring-ring/50 inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium shadow-sm outline-none transition-all active:scale-[.98] focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-70"
      >
        <RotateCw className={"h-4 w-4" + (trying ? " animate-spin" : "")} aria-hidden />
        {trying ? "Đang thử lại…" : "Thử lại"}
      </button>
      <a
        href="/home"
        className="border-border bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-11 items-center justify-center rounded-xl border px-5 text-sm font-medium shadow-sm outline-none transition-all active:scale-[.98] focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        Về Hôm nay
      </a>
    </div>
  );
}
