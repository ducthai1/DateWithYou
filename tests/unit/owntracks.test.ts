import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  ownTracksConfig,
  ownTracksConfigLink,
  parseOwnTracksLocation,
  parseOwnTracksStatus,
  TRACKER_INTERVAL_S,
} from "@/lib/owntracks";

/* Messages shaped like the ones in https://owntracks.org/booklet/tech/json/ */

describe("vị trí OwnTracks gửi", () => {
  test("iPhone: đủ tốc độ, hướng, pin, chế độ", () => {
    const f = parseOwnTracksLocation({ _type: "location", lat: 10.8, lon: 106.75, tst: 1_761_800_000, acc: 12, vel: 31, cog: 90, batt: 64, m: 2 });
    assert.deepEqual(f, { lat: 10.8, lng: 106.75, at: 1_761_800_000_000, accuracy: 12, speedKmH: 31, heading: 90, battery: 64, monitoring: 2 });
  });

  test("Android báo tốc độ 0 khi không biết, và không có hướng hay chế độ", () => {
    const f = parseOwnTracksLocation({ _type: "location", lat: 10.8, lon: 106.75, tst: 1_761_800_000, vel: 0, batt: 80 })!;
    assert.equal(f.speedKmH, null);
    assert.equal(f.heading, null);
    assert.equal(f.monitoring, null);
  });

  test("thứ không phải vị trí, hoặc vị trí vô lý, thì bỏ", () => {
    assert.equal(parseOwnTracksLocation({ _type: "transition", lat: 1, lon: 1, tst: 1 }), null);
    assert.equal(parseOwnTracksLocation({ _type: "location", lat: 95, lon: 1, tst: 1 }), null);
    assert.equal(parseOwnTracksLocation({ _type: "location", lat: "10", lon: 1, tst: 1 }), null);
    assert.equal(parseOwnTracksLocation(null), null);
  });
});

describe("báo cáo quyền của máy", () => {
  test("iPhone: tên hay số của Apple đều đọc được", () => {
    const always = parseOwnTracksStatus({ _type: "status", iOS: { locationManagerAuthorizationStatus: "authorizedAlways" } });
    const inUse = parseOwnTracksStatus({ _type: "status", iOS: { locationManagerAuthorizationStatus: 4 } });
    const denied = parseOwnTracksStatus({ _type: "status", iOS: { locationManagerAuthorizationStatus: "denied", backgroundRefreshStatus: false } });
    assert.equal(always?.location, "ok");
    assert.equal(inUse?.location, "foreground");
    assert.equal(denied?.location, "denied");
    assert.equal(denied?.backgroundRefreshOff, true);
  });

  test("Android: 0 là ổn, 1 là có vấn đề, số khác là không biết", () => {
    const s = parseOwnTracksStatus({ _type: "status", android: { loc: 0, bo: 1, ps: 0, hib: 7 } })!;
    assert.equal(s.platform, "android");
    assert.equal(s.location, "ok");
    assert.equal(s.batteryOptimized, true);
    assert.equal(s.powerSave, false);
    assert.equal(s.hibernation, null);
  });
});

describe("link cấu hình một chạm", () => {
  test("mở ra đúng cài đặt: HTTP, có mật khẩu, chế độ Move, 25 giây cả hai hệ điều hành", () => {
    const link = ownTracksConfigLink(ownTracksConfig({ url: "https://x.test/api/track/owntracks", username: "u", password: "p+/=", tid: "VV" }));
    assert.ok(link.startsWith("owntracks:///config?inline="));
    const cfg = JSON.parse(Buffer.from(decodeURIComponent(link.split("inline=")[1]), "base64").toString("utf8"));
    assert.equal(cfg._type, "configuration");
    assert.equal(cfg.mode, 3);
    assert.equal(cfg.auth, true);
    assert.equal(cfg.password, "p+/=");
    assert.equal(cfg.monitoring, 2);
    assert.equal(cfg.locatorInterval, TRACKER_INTERVAL_S);
    assert.equal(cfg.moveModeLocatorInterval, TRACKER_INTERVAL_S);
    assert.equal(cfg.cmd, true, "không có cmd thì không hỏi được quyền");
    // iOS gửi khi đủ khoảng cách HOẶC đủ giờ: 500 m ở 60 km/h là 30 s, nên 25 s tới trước.
    assert.ok(cfg.locatorDisplacement / (60 / 3.6) > TRACKER_INTERVAL_S);
  });
});
