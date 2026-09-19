"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCw, WifiOff, Wifi } from "lucide-react";

/**
 * Mất kết nối, nói bằng giọng của app — không để trình duyệt tự nói.
 *
 * Trước đây app không hề biết mình đang offline ngoài màn bản đồ: React Query
 * **tạm dừng** truy vấn khi mất mạng, nên năm màn rơi xuống trạng thái rỗng và
 * báo "Chưa có kỷ niệm nào" (tức nói dối rằng dữ liệu đã mất), bốn màn khác
 * treo skeleton mãi, và chín thẻ "Thử lại" viết sẵn không bao giờ hiện ra vì
 * cái nào cũng gác bằng `isError`. Đổi sang `offlineFirst` ở `providers.tsx`
 * làm những thẻ ấy sống lại; thanh này là phần còn thiếu: nói VÌ SAO, một chỗ
 * duy nhất, và cho một nút bấm lại cho cả màn.
 *
 * Nghe `online`/`offline` của window chứ không hỏi `navigator.onLine` mỗi lần
 * render: `onLine` chỉ biết "có nối vào mạng nào đó", nhưng hai sự kiện kia là
 * thứ trình duyệt bắn ra đúng lúc trạng thái đổi, và cũng là thứ React Query
 * dùng để tự chạy lại truy vấn khi có mạng lại.
 */
export function OfflineNotice() {
  const queryClient = useQueryClient();
  const [offline, setOffline] = useState(false);
  const [retrying, setRetrying] = useState(false);
  /* Chỉ khoe "có mạng lại rồi" cho người ĐÃ từng thấy mình mất mạng. */
  const [justBack, setJustBack] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    const sync = () => {
      const now = typeof navigator !== "undefined" && navigator.onLine === false;
      setOffline(now);
      if (now) {
        wasOffline.current = true;
        setJustBack(false);
      } else if (wasOffline.current) {
        wasOffline.current = false;
        setJustBack(true);
      }
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (!justBack) return;
    const t = setTimeout(() => setJustBack(false), 3200);
    return () => clearTimeout(t);
  }, [justBack]);

  if (!offline && !justBack) return null;

  const retry = async () => {
    setRetrying(true);
    try {
      /*
       * Chạy lại những truy vấn ĐANG HIỆN TRÊN MÀN, không phải toàn bộ cache.
       * `type: "active"` là khác biệt giữa "vẽ lại màn này" và "đánh thức ba
       * chục truy vấn của những màn người ta đã rời đi từ lâu".
       */
      await queryClient.refetchQueries({ type: "active" });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[46] flex items-center gap-2 rounded-2xl border border-border bg-card/95 p-3 shadow-elev-float backdrop-blur-sm sm:inset-x-auto sm:left-1/2 sm:w-[26rem] sm:-translate-x-1/2"
    >
      {offline ? (
        <>
          <WifiOff className="text-destructive h-5 w-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Đang mất kết nối</p>
            <p className="text-muted-foreground text-xs">
              Những gì đã tải vẫn xem được. Có mạng lại là tụi mình tự cập nhật.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void retry()}
            disabled={retrying}
            className="border-border hover:bg-muted focus-visible:ring-ring/50 inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 disabled:opacity-60"
          >
            <RotateCw className={"h-3.5 w-3.5" + (retrying ? " animate-spin" : "")} aria-hidden />
            {retrying ? "Đang thử lại…" : "Thử lại"}
          </button>
        </>
      ) : (
        <>
          <Wifi className="text-[var(--success)] h-5 w-5 shrink-0" aria-hidden />
          <p className="text-sm font-medium">Có mạng lại rồi</p>
        </>
      )}
    </div>
  );
}
