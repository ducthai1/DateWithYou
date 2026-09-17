"use client";

import { useEffect, useState } from "react";
import { BatteryCharging, Compass, MonitorSmartphone } from "lucide-react";
import { useDeviceHeading } from "./use-device-heading";

/**
 * Hai thứ phải bật ở MÁY người kia thì bên này mới thấy họ di chuyển.
 *
 * Người dùng báo: người kia tắt màn hình là bên này thấy họ đứng im một chỗ.
 * Đúng, và lý do không nằm ở quyền vị trí.
 *
 * **Web không có cách nào lấy vị trí khi trang đã bị nền hoá.** Không phải là
 * thiếu một quyền nào đó chưa xin — mà là không tồn tại API đó. Android và iOS
 * chỉ cho ứng dụng NATIVE làm việc này; một trang web bị ẩn thì `watchPosition`
 * ngừng gọi lại, hết. Vì vậy cách duy nhất giữ dòng vị trí là giữ cho màn hình
 * đừng tắt, và đó là điều hàng này giải thích thay vì hứa hẹn thứ làm không được.
 *
 * La bàn thì ngược lại: có thật, chỉ là iOS bắt phải hỏi, và lời hỏi đó chỉ
 * được chấp nhận từ bên trong một cú chạm của người dùng — nên nó phải là một
 * cái nút, không thể tự xin lúc mở trang.
 */
export function LiveSharingRow() {
  const compass = useDeviceHeading(false);
  const [wakeLockSupported, setWakeLockSupported] = useState(false);
  const [compassOn, setCompassOn] = useState(false);

  useEffect(() => {
    setWakeLockSupported(typeof navigator !== "undefined" && "wakeLock" in navigator);
  }, []);

  return (
    <div className="border-border space-y-3 rounded-xl border p-3">
      <div className="flex items-start gap-2.5">
        <MonitorSmartphone className="text-accent mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Để người kia thấy bạn đang đi</p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            Trang web không lấy được vị trí khi bị thu nhỏ hoặc khi màn hình tắt — đó là
            giới hạn của trình duyệt, không phải thiếu quyền. Lúc đang dẫn đường app sẽ
            tự giữ cho màn hình sáng;{" "}
            {wakeLockSupported
              ? "máy này hỗ trợ, nên chỉ cần đừng chuyển sang app khác."
              : "máy này không hỗ trợ giữ sáng, nên hãy tăng thời gian chờ tắt màn hình trong Cài đặt của máy."}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2.5">
        <Compass className="text-accent mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Hướng đang nhìn trên bản đồ</p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            Cái phễu xanh chỉ hướng bạn đang quay mặt, để biết đường nào là đường của mình
            lúc dừng ở ngã tư.
          </p>
          {compass.needsPermission && !compassOn ? (
            <button
              type="button"
              onClick={() => void compass.request().then(setCompassOn)}
              className="border-border hover:bg-muted mt-2 inline-flex h-10 items-center rounded-xl border px-3 text-xs font-medium"
            >
              Cho phép dùng la bàn
            </button>
          ) : (
            <p className="text-muted-foreground mt-1 text-xs">
              {compassOn ? "Đã bật ✓" : "Máy này không cần xin quyền riêng."}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2.5">
        <BatteryCharging className="text-accent mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Mức pin của nhau</p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            Chỉ máy Android (Chrome) mới gửi được mức pin. Safari trên iPhone không cho
            trang web đọc pin, nên một bên dùng iPhone thì phía kia sẽ không thấy con số
            này — không phải lỗi, và không có cách nào vòng qua.
          </p>
        </div>
      </div>
    </div>
  );
}
