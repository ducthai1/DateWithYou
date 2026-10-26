"use client";

import { AnimatePresence, motion } from "framer-motion";
import { EyeOff, WifiOff } from "lucide-react";
import type { ListenTogether } from "./use-listen-together";

/**
 * What just happened to the shared playback, said on the picture itself.
 *
 * On the frame rather than in a toast, because the frame is where the person is
 * looking when the video stops or jumps — and inside the box that goes
 * fullscreen, so landscape mode hears it too. Two kinds of line: one that
 * comes and goes (the other person paused, this phone caught up), and one that
 * stays for as long as it is true (this phone has no connection, the other
 * person is in another tab, app or window).
 */
export function ListenNoticeOverlay({ listen }: { listen: ListenTogether }) {
  const connection = listen.pending
    ? "Mất mạng — thao tác của bạn chưa gửi được, sẽ gửi khi có mạng lại"
    : listen.lost
      ? "Mất kết nối — đang nối lại…"
      : null;
  const away =
    listen.partnerAway === "hidden"
      ? `${listen.partnerName} đã chuyển sang tab hoặc ứng dụng khác`
      : listen.partnerAway === "blur"
        ? `${listen.partnerName} đang ở cửa sổ khác — trang xem vẫn mở`
        : null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-2 z-20 flex flex-col items-center gap-1 px-3"
    >
      {connection && (
        <p
          data-listen-connection
          className="flex max-w-full items-center gap-1.5 rounded-full bg-black/75 px-3 py-1 text-center text-[11px] leading-snug font-medium text-amber-200 shadow"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{connection}</span>
        </p>
      )}
      {away && (
        <p
          data-listen-partner-away={listen.partnerAway ?? undefined}
          className="flex max-w-full items-center gap-1.5 rounded-full bg-black/75 px-3 py-1 text-center text-[11px] leading-snug font-medium text-white shadow"
        >
          <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{away}</span>
        </p>
      )}
      <AnimatePresence>
        {listen.notice && (
          <motion.p
            key={listen.notice.key}
            data-listen-notice
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="max-w-full rounded-full bg-black/75 px-3 py-1 text-center text-[11px] leading-snug font-medium text-white shadow"
          >
            {listen.notice.text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
