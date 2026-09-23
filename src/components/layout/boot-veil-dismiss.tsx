"use client";

import { useEffect } from "react";

/**
 * Gỡ tấm khởi động khi màn đầu đã có gì để xem.
 *
 * Cờ TOÀN CỤC chứ không phải sự kiện đơn thuần — và đó là lỗi thứ hai của bản
 * trước. Tín hiệu "sẵn sàng" bắn từ effect của màn Hôm nay, mà effect của
 * component con chạy TRƯỚC component cha, nên cái đến sau gắn listener thì sự
 * kiện đã bay qua từ lâu và mốc hết giờ là lối thoát duy nhất từng chạy. Cờ
 * thì không quan tâm thứ tự: ai tới sau đọc lại vẫn thấy.
 */
declare global {
  interface Window {
    __vivuAppReady?: boolean;
  }
}

const READY_EVENT = "vivu:app-ready";
/** Trần cứng. Một tấm phủ kín màn không có đường thoát là cách nhốt người ta. */
const HARD_LIMIT_MS = 12_000;
/** Route nào tự báo sẵn sàng; nơi khác thì đợi trang tải xong là đủ. */
const REPORTS_READY = new Set(["/home"]);

/** Màn đầu gọi cái này khi đã có dữ liệu thật để vẽ. */
export function markAppReady() {
  if (typeof window === "undefined") return;
  window.__vivuAppReady = true;
  window.dispatchEvent(new Event(READY_EVENT));
}

export function BootVeilDismiss() {
  useEffect(() => {
    const done = () => document.documentElement.setAttribute("data-booted", "");
    if (window.__vivuAppReady) {
      done();
      return;
    }

    const timer = setTimeout(done, HARD_LIMIT_MS);
    window.addEventListener(READY_EVENT, done, { once: true });
    // Chạm vào là bỏ qua — người ta biết mình đang nhìn gì hơn cái đồng hồ này.
    window.addEventListener("pointerdown", done, { once: true });

    /*
     * Route không tự báo (mở thẳng /map, /timeline… từ màn hình chính) thì lấy
     * mốc `load` + một nhịp: tới lúc đó khung của trang đã vẽ, và chờ thêm chỉ
     * là bắt người ta nhìn màu xanh.
     */
    let settle: ReturnType<typeof setTimeout> | undefined;
    if (!REPORTS_READY.has(window.location.pathname)) {
      const after = () => { settle = setTimeout(done, 400); };
      if (document.readyState === "complete") after();
      else window.addEventListener("load", after, { once: true });
    }

    return () => {
      clearTimeout(timer);
      if (settle) clearTimeout(settle);
      window.removeEventListener(READY_EVENT, done);
      window.removeEventListener("pointerdown", done);
    };
  }, []);

  return null;
}
