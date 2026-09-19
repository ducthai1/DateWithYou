"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { compassFromEvent, smoothHeading } from "@/lib/heading";

/**
 * Hằng số thời gian của bộ làm mượt.
 *
 * ~90ms: đủ để dập cái rung vài độ của la bàn, chưa đủ để tay người cảm thấy
 * phễu đi sau mình. Đo trên máy không bóp CPU: trễ ổn định 6° khi quay
 * 93.75°/giây, tức ~63ms.
 */
const TAU_MS = 90;

/**
 * La bàn của máy, để biết đang QUAY MẶT về hướng nào.
 *
 * Khác với `coords.heading` của GPS — cái đó là hướng đang DI CHUYỂN và bằng
 * null khi đứng yên, tức là im lặng đúng vào lúc người ta cần nó nhất: dừng ở
 * ngã tư và xoay người tìm xem đường nào là đường của mình.
 *
 * iOS bắt buộc xin quyền, và chỉ chấp nhận lời xin đó từ trong một cử chỉ của
 * người dùng — gọi lúc mount là bị từ chối lặng lẽ. Nên `request()` được trả ra
 * ngoài để nút bấm gọi, còn hook thì tự gắn listener ở những trình duyệt không
 * cần xin.
 */
type OrientationEventLike = DeviceOrientationEvent & { webkitCompassHeading?: number };
type MaybeRequestable = {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
};

export function useDeviceHeading(enabled: boolean): {
  /**
   * Góc so với bắc thật, đã làm mượt — đọc qua ref, KHÔNG phải state.
   *
   * La bàn bắn ~60 sự kiện mỗi giây. Bản trước gọi `setState` mỗi sự kiện, tức
   * là render lại cả trang bản đồ 60 lần/giây chỉ để đổi một cái `transform`.
   * Máy để bàn nuốt trôi nên không ai thấy; bóp CPU xuống 6× cho giống điện
   * thoại thì đo được: **6 fps, 22 tác vụ dài, 3301ms bị chặn trên 4 giây**.
   * Tắt luồng la bàn đi, cùng điều kiện: **39 fps, 1436ms**. Tức riêng nó lấy
   * mất 33 fps.
   *
   * Nên giá trị đi qua ref, và ai cần vẽ thì tự đăng ký nhận — React không
   * tham gia vào việc xoay một hình khối nữa.
   */
  headingRef: React.RefObject<number | null>;
  /** Đăng ký nhận mỗi lần góc đổi. Trả về hàm huỷ đăng ký. */
  subscribe: (cb: (deg: number) => void) => () => void;
  /** Đã từng đọc được góc nào chưa — state, nhưng chỉ đổi đúng một lần. */
  hasHeading: boolean;
  /** Máy này có đòi hỏi bấm nút để cho phép không (iOS). */
  needsPermission: boolean;
  /** Gọi từ trong một cử chỉ người dùng. */
  request: () => Promise<boolean>;
} {
  const [hasHeading, setHasHeading] = useState(false);
  const [granted, setGranted] = useState(false);
  const smoothed = useRef<number | null>(null);
  const listeners = useRef(new Set<(deg: number) => void>());

  const subscribe = useCallback((cb: (deg: number) => void) => {
    listeners.current.add(cb);
    if (smoothed.current !== null) cb(smoothed.current);
    return () => {
      listeners.current.delete(cb);
    };
  }, []);

  const needsPermission =
    typeof window !== "undefined" &&
    typeof (DeviceOrientationEvent as unknown as MaybeRequestable)?.requestPermission === "function" &&
    !granted;

  const request = useCallback(async () => {
    const api = DeviceOrientationEvent as unknown as MaybeRequestable;
    if (typeof api?.requestPermission !== "function") {
      setGranted(true);
      return true;
    }
    try {
      const res = await api.requestPermission();
      const okay = res === "granted";
      setGranted(okay);
      return okay;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const api = DeviceOrientationEvent as unknown as MaybeRequestable;
    // Nơi nào phải xin thì chờ người ta bấm; nơi nào không thì nghe luôn.
    if (typeof api?.requestPermission === "function" && !granted) return;

    let last = 0;
    const onOrient = (raw: Event) => {
      const deg = compassFromEvent(raw as OrientationEventLike);
      if (deg === null) return;
      /*
       * Làm mượt theo THỜI GIAN, không theo số sự kiện.
       *
       * Một hệ số cố định mỗi sự kiện khiến cảm giác phụ thuộc vào tần suất
       * của máy: iPhone bắn ~60Hz thì nhạy, mà có máy Android chỉ ~20Hz thì
       * cùng hệ số ấy thành ì hẳn. Tính theo `dt` với hằng số thời gian thì
       * mọi máy đều cho ra cùng một cảm giác.
       */
      const now = performance.now();
      const dt = last ? Math.min(now - last, 250) : TAU_MS;
      last = now;
      smoothed.current = smoothHeading(smoothed.current, deg, 1 - Math.exp(-dt / TAU_MS));
      if (!hasHeading) setHasHeading(true);
      for (const cb of listeners.current) cb(smoothed.current);
    };

    /*
     * `deviceorientationabsolute` trước: Chrome trên Android chỉ cho góc so với
     * bắc THẬT ở sự kiện này, còn `deviceorientation` ở đó là góc tương đối với
     * lúc mở trang — dùng nhầm thì cái phễu chỉ đúng nếu người ta tình cờ mở
     * app trong lúc đang quay mặt về bắc.
     */
    const hasAbsolute = "ondeviceorientationabsolute" in window;
    const evt = hasAbsolute ? "deviceorientationabsolute" : "deviceorientation";
    window.addEventListener(evt, onOrient as EventListener);
    return () => window.removeEventListener(evt, onOrient as EventListener);
  }, [enabled, granted, hasHeading]);

  return { headingRef: smoothed, subscribe, hasHeading, needsPermission, request };
}
