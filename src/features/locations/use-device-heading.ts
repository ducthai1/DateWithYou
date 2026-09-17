"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { compassFromEvent, smoothHeading } from "@/lib/heading";

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
  /** Góc so với bắc thật, đã làm mượt. */
  compassHeading: number | null;
  /** Máy này có đòi hỏi bấm nút để cho phép không (iOS). */
  needsPermission: boolean;
  /** Gọi từ trong một cử chỉ người dùng. */
  request: () => Promise<boolean>;
} {
  const [compassHeading, setCompassHeading] = useState<number | null>(null);
  const [granted, setGranted] = useState(false);
  const smoothed = useRef<number | null>(null);

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

    const onOrient = (raw: Event) => {
      const deg = compassFromEvent(raw as OrientationEventLike);
      if (deg === null) return;
      /*
       * Làm mượt, vì la bàn điện thoại nhảy vài độ liên tục. Không mượt thì cái
       * phễu rung như đèn nháy và không ai đọc được nó đang chỉ đâu.
       */
      smoothed.current = smoothHeading(smoothed.current, deg);
      setCompassHeading(smoothed.current);
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
  }, [enabled, granted]);

  return { compassHeading, needsPermission, request };
}
