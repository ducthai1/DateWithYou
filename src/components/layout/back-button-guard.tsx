"use client";

import { useEffect, useRef } from "react";
import { closePhotoViewer, isPhotoViewerOpen } from "@/lib/photo-viewer-state";
import { backIntent, stepsToLeaveApp } from "@/lib/back-intent";

/**
 * Nút back của điện thoại, hành xử như trong một app chứ không như trong tab.
 *
 * Hai chuyện khác nhau, cùng móc vào `popstate` nên ở chung một chỗ:
 *
 * 1. **Đang xem ảnh toàn màn hình thì back phải đóng ảnh.** `PhotoProvider`
 *    nằm ở gốc cây nên nó sống sót qua lần đổi route; back làm route đổi, ảnh
 *    bên trong unmount, còn lớp phủ đen thì ở lại — hiện ra một màn đen ghi
 *    "0/0" và người dùng thì đã bị đá về trang trước. Chặn bằng cách đẩy thêm
 *    một mục lịch sử lúc mở ảnh: cú back đầu tiên ăn đúng mục đó, route không
 *    đổi, và mình chỉ việc đóng ảnh.
 *
 * 2. **Bấm back hai lần liên tiếp thì thoát app**, thay vì lùi mãi qua từng
 *    route đã đi. Mỗi lần chuyển tab là một mục lịch sử, nên đi vài vòng là
 *    phải bấm cả chục lần mới ra được.
 */
export function BackButtonGuard() {
  /** Mốc lịch sử mình tự đẩy vào lúc mở ảnh — để biết còn phải dọn hay không. */
  const sentinel = useRef(false);
  /** Lần `popstate` gần nhất do NGƯỜI dùng gây ra. */
  const lastBackAt = useRef(0);
  /** Cú `popstate` sắp tới là của chính mình gọi `history.back()`, đừng tính. */
  const selfPop = useRef(false);
  /**
   * Số mục lịch sử app đã cộng thêm kể từ lúc mở.
   *
   * `history.length` là con số duy nhất trình duyệt cho đọc; nó không lùi lại
   * khi pop nên đây là ƯỚC LƯỢNG THỪA, không phải số chính xác. Thừa thì cùng
   * lắm là lùi quá một nấc — mà lùi quá nấc đầu tiên nghĩa là ra khỏi app,
   * đúng cái đang muốn. Thiếu mới là hỏng, nên ước lượng lệch về phía thừa.
   */
  const baseLength = useRef(0);

  useEffect(() => {
    baseLength.current = window.history.length;
  }, []);

  /* Mở ảnh → đẩy một mốc. Đóng ảnh bằng cách khác → dọn mốc đó đi. */
  useEffect(() => {
    const onOpen = () => {
      if (sentinel.current) return;
      sentinel.current = true;
      window.history.pushState({ photoViewer: true }, "");
    };
    const onClose = () => {
      if (!sentinel.current) return;
      sentinel.current = false;
      /*
       * Đóng bằng nút X hay Escape thì mốc kia vẫn nằm trong lịch sử. Không
       * dọn thì lần back sau sẽ bị nó ăn mất và người dùng bấm back một cái
       * chẳng thấy gì xảy ra.
       */
      selfPop.current = true;
      window.history.back();
    };
    window.addEventListener("photo-viewer-open", onOpen);
    window.addEventListener("photo-viewer-close", onClose);
    return () => {
      window.removeEventListener("photo-viewer-open", onOpen);
      window.removeEventListener("photo-viewer-close", onClose);
    };
  }, []);

  useEffect(() => {
    const onPop = () => {
      if (selfPop.current) {
        selfPop.current = false;
        return;
      }

      const now = Date.now();
      switch (
        backIntent({
          photoViewerOpen: isPhotoViewerOpen(),
          lastBackAt: lastBackAt.current,
          now,
        })
      ) {
        case "close-photo":
          // Route không đổi: cú back vừa ăn đúng cái mốc đẩy vào lúc mở ảnh.
          sentinel.current = false;
          closePhotoViewer();
          // Đóng ảnh KHÔNG tính là một nhịp của "bấm hai lần": vuốt xem ảnh
          // rồi back ra, xong back tiếp — cú thứ hai đó là lần đầu tiên thật.
          lastBackAt.current = 0;
          return;
        case "exit":
          lastBackAt.current = 0;
          window.history.go(-stepsToLeaveApp(window.history.length, baseLength.current));
          return;
        case "navigate":
          // Trang đã lùi rồi; chỉ ghi lại mốc để biết cú tiếp theo có phải
          // nhịp thứ hai hay không.
          lastBackAt.current = now;
          return;
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return null;
}
