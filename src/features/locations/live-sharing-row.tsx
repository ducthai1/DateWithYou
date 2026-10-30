"use client";

import { useState } from "react";
import { BatteryCharging, Compass } from "lucide-react";
import { useDeviceHeading } from "./use-device-heading";
import { TrackingSetup } from "./tracking-setup";

/**
 * Hai thứ phải bật ở MÁY người kia thì bên này mới thấy họ di chuyển.
 *
 * Người dùng báo: người kia tắt màn hình là bên này thấy họ đứng im một chỗ.
 * Đúng, và lý do không nằm ở quyền vị trí.
 *
 * **Web không có cách nào lấy vị trí khi trang đã bị nền hoá.** Không phải là
 * thiếu một quyền nào đó chưa xin — mà là không tồn tại API đó. Android và iOS
 * chỉ cho ứng dụng NATIVE làm việc này. Bản trước dừng ở đó và chỉ khuyên giữ
 * màn hình sáng; nay một app native có sẵn (OwnTracks) làm phần chạy nền và gửi
 * vị trí về server — xem TrackingSetup và src/lib/owntracks.ts.
 *
 * La bàn thì ngược lại: có thật, chỉ là iOS bắt phải hỏi, và lời hỏi đó chỉ
 * được chấp nhận từ bên trong một cú chạm của người dùng — nên nó phải là một
 * cái nút, không thể tự xin lúc mở trang.
 */
export function LiveSharingRow() {
  const compass = useDeviceHeading(false);
  const [compassOn, setCompassOn] = useState(false);

  return (
    <div className="border-border space-y-3 rounded-xl border p-3">
      <TrackingSetup />

      <div className="flex items-start gap-2.5">
        <Compass className="text-accent-ink mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
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
        <BatteryCharging className="text-accent-ink mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Mức pin của nhau</p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            Android (Chrome) tự gửi mức pin. Safari trên iPhone không cho trang web đọc
            pin, nên iPhone chỉ gửi được khi đã kết nối OwnTracks ở trên — OwnTracks gửi
            kèm mức pin mỗi lần gửi vị trí.
          </p>
        </div>
      </div>
    </div>
  );
}
