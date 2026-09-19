import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { BackdropArt } from "@/components/theme/app-backdrop";
import { OfflineRetry } from "@/features/offline/offline-retry";

export const metadata: Metadata = {
  title: "Đang mất kết nối",
  robots: { index: false, follow: false },
};

/**
 * Trang thay cho "No internet" của trình duyệt.
 *
 * Service worker giữ sẵn trang này lúc cài, rồi đưa ra cho BẤT KỲ lần điều
 * hướng nào thất bại mà không có bản lưu nào khác. Trước đây chỉ `/home` và
 * `/map` có bản lưu; 37 route còn lại rơi thẳng vào trang lỗi của trình duyệt.
 *
 * Phải tự đứng được khi không có mạng: không truy vấn, không ảnh tải từ xa,
 * không phụ thuộc gì ngoài những thứ đã nằm trong cache — nên nó là server
 * component tĩnh, và phần bấm-lại tách riêng thành một client component nhỏ.
 */
export default function OfflinePage() {
  return (
    <div
      data-chromeless=""
      data-notfound=""
      className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-4 px-4 py-16 text-center"
    >
      <BackdropArt art="emptyMap" />

      <span
        className="bg-accent-soft flex h-16 w-16 items-center justify-center rounded-full"
        aria-hidden="true"
      >
        <WifiOff className="text-accent-ink h-7 w-7" strokeWidth={1.6} />
      </span>

      <div className="space-y-1.5">
        <h1 className="text-h1 font-semibold">Đang mất kết nối</h1>
        <p className="text-muted-foreground text-sm">
          Không phải do bạn đâu. Kỷ niệm của hai bạn vẫn còn nguyên — có mạng lại là mở được ngay.
        </p>
      </div>

      <OfflineRetry />
    </div>
  );
}
