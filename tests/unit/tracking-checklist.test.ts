import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { platformOf, trackingProblems, TRACKER_SILENT_MS, type TrackerState } from "@/lib/tracking-checklist";

/*
 * Chủ repo chốt 30/10/2026: thiếu quyền nào thì báo kèm NÚT cấp ngay tại chỗ.
 * Mỗi bài dưới đây kiểm một tình huống thiếu, và nút đầu tiên phải là nút sửa.
 */

const NOW = 1_761_800_000_000;
const linked = (over: Partial<Extract<TrackerState, { linked: true }>> = {}): TrackerState => ({
  linked: true,
  lastSeenAt: new Date(NOW - 20_000),
  lastFixAt: new Date(NOW - 20_000),
  monitoring: 2,
  health: { platform: "ios", location: "ok", batteryOptimized: null, powerSave: null, hibernation: null, backgroundRefreshOff: false },
  ...over,
});
const run = (over: Partial<Parameters<typeof trackingProblems>[0]>) =>
  trackingProblems({ web: "granted", tracker: linked(), platform: "ios", now: NOW, ...over });

describe("quyền vị trí của chính Vivu", () => {
  test("chưa hỏi: nút cho phép ngay tại chỗ", () => {
    const [p] = run({ web: "prompt" });
    assert.equal(p.key, "web-location");
    assert.deepEqual(p.actions, ["ask-location"]);
    assert.equal(p.steps, undefined);
  });

  test("đã bị chặn: vẫn có nút thử lại, kèm đúng đường đi của iPhone / Android", () => {
    assert.match(run({ web: "denied" })[0].steps!, /Trang web Safari/);
    assert.match(run({ web: "denied", platform: "android" })[0].steps!, /Cài đặt trang web/);
  });
});

describe("app chạy nền", () => {
  test("chưa cài: gợi ý, nút Cài + Kết nối", () => {
    const [p] = run({ tracker: { linked: false } });
    assert.equal(p.severity, "suggest");
    assert.deepEqual(p.actions, ["install-tracker", "connect-tracker"]);
  });

  test("máy tính không có túi: không nhắc app chạy nền", () => {
    assert.deepEqual(run({ tracker: { linked: false }, platform: "other" }), []);
  });

  test("đã kết nối mà chưa nhận gì: nút mở OwnTracks để nó hỏi quyền", () => {
    const [p] = run({ tracker: linked({ lastSeenAt: null, lastFixAt: null }) });
    assert.equal(p.severity, "block");
    assert.equal(p.actions[0], "open-tracker");
  });

  test("iPhone chỉ cho 'Khi dùng': chặn, chỉ đúng chỗ chọn 'Luôn luôn'", () => {
    const [p] = run({ tracker: linked({ health: { platform: "ios", location: "foreground", batteryOptimized: null, powerSave: null, hibernation: null, backgroundRefreshOff: false } }) });
    assert.equal(p.key, "tracker-location");
    assert.match(p.steps!, /Luôn luôn/);
  });

  test("Android tối ưu pin: cảnh báo, chỉ chỗ 'Không hạn chế'", () => {
    const items = run({ platform: "android", tracker: linked({ health: { platform: "android", location: "ok", batteryOptimized: true, powerSave: false, hibernation: false, backgroundRefreshOff: null } }) });
    assert.deepEqual(items.map((i) => i.key), ["tracker-battery"]);
    assert.match(items[0].steps!, /Không hạn chế/);
  });

  test("chế độ tiết kiệm thay vì Move: cảnh báo, nút đặt lại", () => {
    const [p] = run({ tracker: linked({ monitoring: 1 }) });
    assert.equal(p.key, "tracker-mode");
    assert.deepEqual(p.actions, ["open-tracker"]);
  });

  test("im lặng quá 3 phút: cảnh báo đã ngừng gửi", () => {
    const old = new Date(NOW - TRACKER_SILENT_MS - 1000);
    assert.deepEqual(run({ tracker: linked({ lastSeenAt: old, lastFixAt: old }) }).map((i) => i.key), ["tracker-silent"]);
  });

  test("mọi thứ ổn: không báo gì", () => {
    assert.deepEqual(run({}), []);
  });
});

test("nhận ra máy", () => {
  assert.equal(platformOf("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), "ios");
  assert.equal(platformOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5), "ios");
  assert.equal(platformOf("Mozilla/5.0 (Linux; Android 14; SM-S911B)"), "android");
  assert.equal(platformOf("Mozilla/5.0 (X11; Linux x86_64)"), "other");
});
