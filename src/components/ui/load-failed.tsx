"use client";

import { Button } from "@/components/ui/button";

/**
 * "Chưa tải được", với một nút bấm lại — thay cho việc báo rỗng.
 *
 * Năm màn trong app từng rẽ thẳng từ `isLoading` sang trạng thái rỗng, nên khi
 * không lấy được dữ liệu thì chúng nói "Chưa có kỷ niệm nào" / "Chưa có chuyến
 * đi nào" — tức bảo hai người rằng thứ họ đã lưu biến mất. Hai màn khác đã
 * được sửa riêng từ trước, mỗi màn một kiểu chữ; gom lại một chỗ để câu chữ và
 * hành vi không trôi mỗi nơi một ít.
 *
 * Cặp `isPending`/`isError` phải xét TRƯỚC `length === 0`, nếu không thì danh
 * sách rỗng vì lỗi vẫn rơi xuống nhánh rỗng — đúng cái bẫy này sinh ra để chặn.
 */
export function LoadFailed({
  what,
  onRetry,
  retrying,
}: {
  /** Danh từ, ghép vào "Không tải được …" — ví dụ "dòng kỷ niệm". */
  what: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div
      role="alert"
      className="border-border bg-card flex flex-col items-center gap-3 rounded-xl border p-6 text-center"
    >
      <p className="font-medium">Không tải được {what}</p>
      <p className="text-muted-foreground text-sm">
        Mạng trục trặc một chút thôi, thử lại giúp mình nhé.
      </p>
      <Button variant="outline" onClick={onRetry} disabled={retrying}>
        {retrying ? "Đang thử lại…" : "Thử lại"}
      </Button>
    </div>
  );
}
