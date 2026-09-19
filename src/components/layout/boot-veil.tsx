"use client";

import { useEffect, useState } from "react";

/**
 * Giữ màn khởi động cho tới khi màn đầu tiên THẬT SỰ có gì để xem.
 *
 * Hệ điều hành bỏ ảnh khởi động ngay khi trang vẽ khung hình đầu tiên — mà
 * khung hình đầu tiên của app này là một skeleton: `/home` là client component,
 * toàn bộ nội dung treo sau một truy vấn tRPC. Nên người dùng thấy ảnh đẹp,
 * rồi một màn xương xẩu, rồi mới tới nội dung. Tấm này lấp đúng khoảng giữa,
 * và cố ý dùng **cùng nền navy `#1E3A5F`** với ảnh khởi động để chỗ giao nhau
 * không nhìn ra được.
 *
 * ⚠️ Chỉ bật khi app đã được CÀI (standalone). Trên trình duyệt thường không
 * có ảnh khởi động nào để nối tiếp, nên tấm này sẽ thành một mảng navy chớp
 * lên mỗi lần tải lại — tệ hơn hẳn thứ nó định chữa.
 *
 * Ba lối ra, và lối thứ ba là thứ bắt buộc phải có: màn báo đã sẵn sàng, hoặc
 * hết 6 giây, hoặc người dùng chạm vào. Một tấm phủ toàn màn không có đường
 * thoát cứng là cách bẫy người ta trong một màn navy nếu có gì đó hỏng.
 */
const READY_EVENT = "vivu:first-screen-ready";
const HARD_LIMIT_MS = 6000;

/** Màn đầu tiên gọi cái này khi đã có dữ liệu để vẽ. */
export function markFirstScreenReady() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(READY_EVENT));
}

export function BootVeil() {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const installed =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!installed) return;
    setShow(true);

    const done = () => setLeaving(true);
    window.addEventListener(READY_EVENT, done, { once: true });
    window.addEventListener("pointerdown", done, { once: true });
    const t = setTimeout(done, HARD_LIMIT_MS);
    return () => {
      window.removeEventListener(READY_EVENT, done);
      window.removeEventListener("pointerdown", done);
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setShow(false), 320);
    return () => clearTimeout(t);
  }, [leaving]);

  if (!show) return null;

  return (
    <div
      aria-hidden="true"
      /* `pointer-events-none` ngay khi bắt đầu mờ đi: 320ms mà vẫn ăn chạm thì
         cú chạm đầu tiên của người ta rơi vào khoảng không. */
      className={
        "fixed inset-0 z-[120] flex items-center justify-center bg-[#1E3A5F] transition-opacity duration-300 " +
        (leaving ? "pointer-events-none opacity-0" : "opacity-100")
      }
    >
      <span className="h-10 w-10 animate-pulse rounded-2xl bg-white/85" />
    </div>
  );
}
