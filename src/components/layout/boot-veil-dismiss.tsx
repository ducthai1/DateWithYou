"use client";

import { useEffect } from "react";

import { reportsAppReady } from "./boot-ready-routes";

/**
 * Gỡ tấm khởi động khi màn đang mở đã có gì để xem.
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
/** Đợi thêm sau `load` cho màn KHÔNG tự báo — đủ để khung trang vẽ xong. */
const SETTLE_MS = 400;

/** Màn đang mở gọi cái này khi đã có dữ liệu thật để vẽ. */
export function markAppReady() {
  if (typeof window === "undefined") return;
  window.__vivuAppReady = true;
  window.dispatchEvent(new Event(READY_EVENT));
}

/**
 * Màn chính báo "đã có gì để xem" theo trạng thái truy vấn của chính nó.
 *
 * Trước đây chỉ `/home` làm việc này, nên mọi màn khác gỡ tấm che ở `load` +
 * 400ms — mà `load` không hề đợi dữ liệu. Đo thật ở `/calendar`, mạng trễ
 * 900ms: tấm che gỡ lúc 8404ms trong khi khung xương vẫn chiếm 6,8% màn. Đúng
 * cái "khung xương trắng chen giữa splash và nội dung".
 *
 * Màn nào gọi hook này thì tên route của nó phải có trong `BOOT_READY_ROUTES`;
 * bài kiểm gác cả hai chiều.
 */
export function useAppReady(ready: boolean) {
  useEffect(() => {
    if (ready) markAppReady();
  }, [ready]);
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
     * Màn không tự báo (mở thẳng /settings, một trang tĩnh…) thì lấy mốc `load`
     * cộng một nhịp: tới lúc đó khung của trang đã vẽ, và chờ thêm chỉ là bắt
     * người ta nhìn màu xanh.
     */
    let settle: ReturnType<typeof setTimeout> | undefined;
    if (!reportsAppReady(window.location.pathname)) {
      const after = () => { settle = setTimeout(done, SETTLE_MS); };
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
