import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_FENCE, FENCE_REPEAT_MS, shouldAnnounce, stepFence, type FenceState } from "@/lib/geofence";
import { stepMeeting, type MeetState } from "@/lib/meeting-detect";

/* ~0.0009° of latitude is 100 m. */
const HOME = { lat: 10.8, lng: 106.7, radiusM: 120 };
const fixAt = (dLatM: number, at: number, accuracy: number | null = 15) => ({
  kind: "fix" as const,
  lat: HOME.lat + dLatM / 111_000,
  lng: HOME.lng,
  accuracy,
  at,
});

describe("vòng Nhà / điểm hẹn", () => {
  test("lần đầu thấy chỉ ghi nhận chỗ đang đứng, không báo — đặt nhà khi đang ở nhà không được thành 'vừa về nhà'", () => {
    const r = stepFence(EMPTY_FENCE, HOME, fixAt(10, 1000));
    assert.equal(r.event, null);
    assert.deepEqual(r.state, { inside: true, at: 1000 });
  });

  test("ra khỏi vòng rồi quay lại: rời nhà, về nhà", () => {
    let s: FenceState = { inside: true, at: 0 };
    const out = stepFence(s, HOME, fixAt(800, 1000));
    assert.equal(out.event, "leave");
    s = out.state;
    const back = stepFence(s, HOME, fixAt(20, 2000));
    assert.equal(back.event, "enter");
  });

  test("đứng sát mép thì giữ nguyên, không lật qua lật lại", () => {
    const s: FenceState = { inside: true, at: 0 };
    // 150 m: past the 120 m edge but inside the 60 m margin.
    const r = stepFence(s, HOME, fixAt(150, 1000));
    assert.equal(r.event, null);
    assert.equal(r.state, s);
  });

  test("điểm định vị mờ (sai số 300 m) không nói được đang ở phía nào", () => {
    const s: FenceState = { inside: true, at: 0 };
    assert.equal(stepFence(s, HOME, fixAt(800, 1000, 300)).event, null);
  });

  test("tin cũ tới muộn (hàng đợi xả sau hầm) bị bỏ", () => {
    const s: FenceState = { inside: true, at: 5000 };
    assert.equal(stepFence(s, HOME, fixAt(800, 4000)).event, null);
  });

  test("máy tự báo vượt vòng thì tin luôn, không cần đo khoảng cách", () => {
    const s: FenceState = { inside: false, at: 0 };
    assert.equal(stepFence(s, HOME, { kind: "transition", event: "enter", at: 1000 }).event, "enter");
  });

  test("báo lại cùng vòng quá sớm, hoặc báo chuyện đã cũ, thì im", () => {
    const now = 100 * 60_000;
    assert.equal(shouldAnnounce(now, now - FENCE_REPEAT_MS + 1, now), false);
    assert.equal(shouldAnnounce(now, now - FENCE_REPEAT_MS, now), true);
    assert.equal(shouldAnnounce(now - 11 * 60_000, null, now), false);
  });
});

describe("gặp nhau, phía server", () => {
  const now = 1_000_000;
  const at = (dLatM: number, accuracy: number | null = 20) => ({ lat: 10.8 + dLatM / 111_000, lng: 106.7, accuracy, at: now - 5000 });

  test("đang ở cạnh nhau từ đầu thì không phải vừa gặp", () => {
    const r = stepMeeting({ together: null, at: null }, at(0), at(10), now);
    assert.equal(r.met, false);
    assert.equal(r.state.together, true);
  });

  test("xa nhau rồi tới gần: gặp nhau, đúng một lần", () => {
    let s: MeetState = { together: false, at: 0 };
    const r = stepMeeting(s, at(0), at(30), now);
    assert.equal(r.met, true);
    s = r.state;
    assert.equal(stepMeeting(s, at(0), at(50), now).met, false);
  });

  test("GPS chập chờn trong khoảng giữa không làm báo lại", () => {
    const s: MeetState = { together: true, at: 0 };
    const r = stepMeeting(s, at(0), at(150), now);
    assert.equal(r.met, false);
    assert.equal(r.state, s);
  });

  test("sai số lớn nới vòng, nhưng có trần — cách một con phố không tính là gặp", () => {
    const s: MeetState = { together: false, at: 0 };
    assert.equal(stepMeeting(s, at(0, 60), at(110, 60), now).met, true);
    assert.equal(stepMeeting(s, at(0, 500), at(140, 500), now).met, false);
  });

  test("vị trí cũ không phải chỗ người ta đang đứng", () => {
    const s: MeetState = { together: false, at: 0 };
    const stale = { ...at(10), at: now - 4 * 60_000 };
    assert.equal(stepMeeting(s, at(0), stale, now).met, false);
  });
});
