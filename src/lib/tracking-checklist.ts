/**
 * What is stopping this phone from being seen on the other one — and, for
 * each, the one button that fixes it from right here.
 *
 * Pure so the wording and the order can be checked without a phone. The rule
 * the owner set (30/10/2026): a missing permission is announced with a button
 * that asks for it on the spot, not a paragraph sending people into Settings.
 * Where no button can do it — a permission already refused, which no browser
 * will ask for again; a setting that belongs to another app — the button
 * opens the closest place that can, and the steps are short and exact.
 */
import { MONITORING_MOVE, type TrackerHealth } from "@/lib/owntracks";

export type Platform = "ios" | "android" | "other";
export type WebLocation = "granted" | "prompt" | "denied" | "unknown";

export type TrackerState =
  | { linked: false }
  | {
      linked: true;
      lastSeenAt: Date | string | null;
      lastFixAt: Date | string | null;
      monitoring: number | null;
      health: (TrackerHealth & { at?: Date | string }) | null;
    };

/** What a quick button does. The hook turns each into the real call. */
export type CheckAction = "ask-location" | "install-tracker" | "connect-tracker" | "open-tracker";

export type CheckItem = {
  key: string;
  /** "block": nothing gets through. "warn": it works, badly. "suggest": not set up yet. */
  severity: "block" | "warn" | "suggest";
  title: string;
  detail: string;
  actions: CheckAction[];
  /** Only when a button cannot finish the job on its own. */
  steps?: string;
};

/** No fix for this long while linked means it has stopped, not that they stood still: it reports on a timer. */
export const TRACKER_SILENT_MS = 3 * 60_000;

const ms = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : 0);

export function platformOf(ua: string, touchPoints = 0): Platform {
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return "ios";
  return /Android/.test(ua) ? "android" : "other";
}

function webLocationSteps(platform: Platform): string {
  if (platform === "ios")
    return "Cài đặt › Quyền riêng tư & Bảo mật › Dịch vụ định vị › Trang web Safari › chọn “Khi dùng ứng dụng”, rồi mở lại Vivu.";
  if (platform === "android")
    return "Trong Chrome: ⋮ › Cài đặt › Cài đặt trang web › Vị trí › Vivu › Cho phép, rồi mở lại Vivu.";
  return "Bấm biểu tượng ổ khoá cạnh địa chỉ trang › Vị trí › Cho phép, rồi tải lại trang.";
}

export function trackingProblems({
  web,
  tracker,
  platform,
  now,
}: {
  web: WebLocation;
  tracker: TrackerState | null;
  platform: Platform;
  now: number;
}): CheckItem[] {
  const out: CheckItem[] = [];

  if (web === "prompt")
    out.push({
      key: "web-location",
      severity: "block",
      title: "Vivu chưa được dùng vị trí",
      detail: "Không có vị trí thì không dẫn đường được và người kia không thấy bạn.",
      actions: ["ask-location"],
    });
  else if (web === "denied")
    out.push({
      key: "web-location",
      severity: "block",
      title: "Vị trí của Vivu đang bị chặn",
      detail: "Trình duyệt không cho trang hỏi lại sau khi đã bị từ chối — bấm thử, nếu không hiện hộp hỏi thì làm theo bước dưới.",
      actions: ["ask-location"],
      steps: webLocationSteps(platform),
    });

  // The tracker lives on phones; a laptop has no pocket to be in.
  if (!tracker || platform === "other") return out;

  if (!tracker.linked) {
    out.push({
      key: "tracker-link",
      severity: "suggest",
      title: "Tắt màn hình là người kia thấy bạn đứng im",
      detail:
        "Trang web không lấy được vị trí khi màn hình tắt. Cài OwnTracks (miễn phí) rồi bấm “Kết nối” — nó gửi vị trí của bạn mỗi 25 giây kể cả khi máy nằm trong túi.",
      actions: ["install-tracker", "connect-tracker"],
    });
    return out;
  }

  if (!tracker.lastSeenAt) {
    out.push({
      key: "tracker-silent",
      severity: "block",
      title: "Chưa nhận được vị trí nào từ OwnTracks",
      detail:
        platform === "ios"
          ? "Bấm “Mở OwnTracks”: app sẽ nhận cài đặt của Vivu và hỏi quyền vị trí — chọn “Luôn cho phép”."
          : "Bấm “Mở OwnTracks”: app sẽ nhận cài đặt của Vivu và hỏi quyền vị trí — chọn Cho phép, và đồng ý khi nó hỏi bỏ tối ưu pin.",
      actions: ["open-tracker", "install-tracker"],
    });
    return out;
  }

  const health = tracker.health;
  if (health?.location === "foreground" || health?.location === "denied")
    out.push({
      key: "tracker-location",
      severity: "block",
      title:
        health.location === "denied"
          ? "OwnTracks đang bị chặn vị trí"
          : "OwnTracks chỉ được dùng vị trí khi đang mở",
      detail: "Như vậy tắt màn hình là nó ngừng gửi.",
      actions: ["open-tracker"],
      steps:
        health.platform === "ios"
          ? "Cài đặt › OwnTracks › Vị trí › chọn “Luôn luôn” và bật “Vị trí chính xác”."
          : "Cài đặt › Ứng dụng › OwnTracks › Quyền › Vị trí › “Cho phép mọi lúc”.",
    });
  if (health?.batteryOptimized)
    out.push({
      key: "tracker-battery",
      severity: "warn",
      title: "Android đang tối ưu pin cho OwnTracks",
      detail: "Máy có thể tắt ngầm nó giữa chuyến đi.",
      actions: ["open-tracker"],
      steps: "Cài đặt › Ứng dụng › OwnTracks › Pin › “Không hạn chế”.",
    });
  if (health?.backgroundRefreshOff)
    out.push({
      key: "tracker-refresh",
      severity: "warn",
      title: "“Làm mới ứng dụng trong nền” đang tắt cho OwnTracks",
      detail: "iPhone có thể không đánh thức nó khi bạn đã đi xa.",
      actions: ["open-tracker"],
      steps: "Cài đặt › OwnTracks › bật “Làm mới ứng dụng trong nền”.",
    });
  if (tracker.monitoring !== null && tracker.monitoring !== MONITORING_MOVE)
    out.push({
      key: "tracker-mode",
      severity: "warn",
      title: "OwnTracks đang ở chế độ tiết kiệm",
      detail: "Chỉ gửi khi bạn đã đi xa một đoạn, không phải mỗi 25 giây.",
      actions: ["open-tracker"],
    });
  if (now - Math.max(ms(tracker.lastSeenAt), ms(tracker.lastFixAt)) > TRACKER_SILENT_MS)
    out.push({
      key: "tracker-silent",
      severity: "warn",
      title: "OwnTracks đã ngừng gửi",
      detail: "Lần cuối là hơn 3 phút trước — có thể nó đã bị tắt, hoặc máy đang mất mạng.",
      actions: ["open-tracker"],
    });
  return out;
}
