/*
 * What the background tracker makes possible beyond a moving dot: the
 * iPhone's battery, emotions that reach a pocket, "đã về nhà / đã tới quán",
 * "hai bạn đã gặp nhau", rides that record themselves, and route times
 * learned from those rides. Pushes are caught, not sent.
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, closeDatabase, makeCouple } from "./_harness.ts";
import { POST } from "@/app/api/track/owntracks/route";
import { interceptPushForTests, type PushPayload } from "@/server/lib/push";
import { LiveLocationModel } from "@/server/db/models/live-location";
import { TrackerLinkModel } from "@/server/db/models/tracker-link";
import { TrackPointModel } from "@/server/db/models/track-point";
import { LocationModel } from "@/server/db/models/location";
import { RideModel } from "@/server/db/models/ride";
import { SpeedCellModel } from "@/server/db/models/speed-cell";
import { REGION_MEET } from "@/lib/owntracks";
import { routeTimer } from "@/server/lib/learned-route-time";

type Couple = Awaited<ReturnType<typeof makeCouple>>;
const sent: Array<{ to: string; payload: PushPayload }> = [];

before(async () => {
  await freshDatabase();
  interceptPushForTests(async (to, payload) => {
    sent.push({ to, payload });
    return { reason: "sent", devices: 1, delivered: 1 };
  });
});
after(async () => {
  interceptPushForTests(null);
  await closeDatabase();
});

const decode = (link: string) =>
  JSON.parse(Buffer.from(decodeURIComponent(link.split("inline=")[1]), "base64").toString("utf8")) as {
    username: string;
    password: string;
  };

async function trackerFor(couple: Couple) {
  const view = await couple.a.caller.tracker.connect();
  assert.ok(view.linked);
  const { username, password } = decode(view.configLink);
  return async (body: unknown) => {
    const res = await POST(
      new Request("http://localhost/api/track/owntracks", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
        },
        body: JSON.stringify(body),
      }),
    );
    assert.equal(res.status, 200);
    return (await res.json()) as Array<Record<string, unknown>>;
  };
}

/** ~111 m per 0.001° of latitude. */
const fixAt = (lat: number, lng: number, secondsAgo = 0, extra: Record<string, unknown> = {}) => ({
  _type: "location",
  lat,
  lon: lng,
  tst: Math.floor(Date.now() / 1000) - secondsAgo,
  acc: 15,
  vel: 0,
  tid: "VV",
  ...extra,
});
const sentTo = (userId: string, tag?: string) => sent.filter((s) => s.to === userId && (!tag || s.payload.tag === tag));

describe("pin iPhone", () => {
  test("app trên iPhone không gửi pin, nhưng không còn xoá mất pin OwnTracks vừa gửi", async () => {
    const couple = await makeCouple({ a: "An", b: "Binh" });
    const post = await trackerFor(couple);
    // The app is on screen (Safari: no battery), so it keeps the position…
    await couple.a.caller.location.pingLiveLocation({ lat: 10.8, lng: 106.7, batteryLevel: null });
    await post(fixAt(10.8, 106.7, 0, { batt: 64 }));
    let seen = await couple.b.caller.location.pingLiveLocation({ lat: 10.7, lng: 106.6 });
    assert.equal(seen[0].batteryLevel, 64, "the tracker's level was dropped because the app's row won");
    // …and its next ping, still without a level, leaves it alone.
    await couple.a.caller.location.pingLiveLocation({ lat: 10.8, lng: 106.7, batteryLevel: null });
    seen = await couple.b.caller.location.pingLiveLocation({ lat: 10.7, lng: 106.6 });
    assert.equal(seen[0].batteryLevel, 64, "an app ping with no level wiped the tracker's");
    assert.equal(await TrackPointModel.countDocuments({ spaceId: couple.spaceId }), 1, "the fix was not kept for trips");
  });

  test("mức pin cũ quá nửa giờ thì không hiện nữa", async () => {
    const couple = await makeCouple({ a: "Cuc", b: "Dung" });
    await couple.a.caller.location.pingLiveLocation({ lat: 10.8, lng: 106.7, batteryLevel: 50 });
    await LiveLocationModel.updateOne({ spaceId: couple.spaceId, userId: couple.a.userId }, { $set: { batteryAt: new Date(Date.now() - 40 * 60_000) } });
    const seen = await couple.b.caller.location.pingLiveLocation({ lat: 10.7, lng: 106.6 });
    assert.equal(seen[0].batteryLevel, null);
  });
});

describe("nút cảm xúc tới được máy đang cất túi", () => {
  test("'Nhanh lên!' thành thông báo; bấm dồn không thành nhiều thông báo; người kia đang mở app thì thôi", async () => {
    const couple = await makeCouple({ a: "Em", b: "Giang" });
    await couple.a.caller.location.pingLiveLocation({ lat: 10.8, lng: 106.7, pingAction: "HURRY" });
    const first = sentTo(couple.b.userId, "ping");
    assert.equal(first.length, 1);
    assert.match(first[0].payload.title, /Em: Nhanh lên!/);

    await couple.a.caller.location.pingLiveLocation({ lat: 10.8, lng: 106.7, pingAction: "JAM" });
    assert.equal(sentTo(couple.b.userId, "ping").length, 1, "a second tap moments later buzzed again");

    // Their app is on the map now: the banner shows it, no notification on top.
    await couple.b.caller.location.pingLiveLocation({ lat: 10.7, lng: 106.6 });
    await LiveLocationModel.updateOne({ spaceId: couple.spaceId, userId: couple.a.userId }, { $set: { pingAt: new Date(Date.now() - 60_000) } });
    await couple.a.caller.location.pingLiveLocation({ lat: 10.8, lng: 106.7, pingAction: "WAIT" });
    assert.equal(sentTo(couple.b.userId, "ping").length, 1);

    // A plain position write is never a notification.
    assert.equal(sentTo(couple.a.userId).length, 0);
  });
});

describe("về nhà, rời nhà, tới điểm hẹn", () => {
  const HOME = { lat: 10.8, lng: 106.7 };
  let couple: Couple;
  let post: (b: unknown) => Promise<Array<Record<string, unknown>>>;

  test("đặt nhà khi đang ở nhà: điện thoại được cài vùng Nhà, người kia không nhận gì", async () => {
    couple = await makeCouple({ a: "Hoa", b: "Khang" });
    post = await trackerFor(couple);
    await couple.a.caller.tracker.setHome(HOME);
    const reply = await post(fixAt(HOME.lat, HOME.lng, 600));
    const cmd = reply.find((m) => m.action === "setWaypoints") as { waypoints: { waypoints: Array<{ desc: string }> } } | undefined;
    assert.ok(cmd, "the Home region was never sent to the phone");
    assert.deepEqual(cmd.waypoints.waypoints.map((w) => w.desc), ["Nhà"]);
    assert.equal(sentTo(couple.b.userId).length, 0);

    const again = await post(fixAt(HOME.lat, HOME.lng, 590));
    assert.ok(!again.some((m) => m.action === "setWaypoints"), "the same region re-sent on every fix");
  });

  test("đi xa 1 km: người kia nhận 'vừa rời nhà'", async () => {
    await post(fixAt(HOME.lat + 0.009, HOME.lng, 300));
    const told = sentTo(couple.b.userId, "home");
    assert.equal(told.length, 1);
    assert.match(told[0].payload.title, /Hoa vừa rời nhà/);
  });

  test("quay về sau đó: 'đã về nhà'", async () => {
    // Past the ten-minute window that stops GPS wobble announcing twice.
    await TrackerLinkModel.updateOne({ spaceId: couple.spaceId, userId: couple.a.userId }, { $set: { "homeFence.announcedAt": new Date(Date.now() - 20 * 60_000) } });
    await post(fixAt(HOME.lat, HOME.lng, 200));
    const told = sentTo(couple.b.userId, "home");
    assert.equal(told.length, 2);
    assert.match(told[1].payload.title, /Hoa đã về nhà/);
  });

  test("chuyến cả hai đã nhận: điểm hẹn được cài lên máy, tới nơi thì người kia biết", async () => {
    const place = await LocationModel.create({
      spaceId: couple.spaceId,
      name: "Cà phê Gió",
      district: "Quận 1",
      category: "Cà phê",
      createdBy: couple.a.userId,
      geo: { lat: 10.776, lng: 106.701 },
    });
    const invite = await couple.a.caller.location.sendNavInvite({ locationId: String(place._id), locationName: "Cà phê Gió" });
    await couple.b.caller.location.respondNavInvite({ inviteId: invite.id, accept: true });

    const reply = await post(fixAt(10.79, 106.7, 100));
    const cmd = reply.find((m) => m.action === "setWaypoints") as { waypoints: { waypoints: Array<{ desc: string; lat: number }> } } | undefined;
    assert.ok(cmd, "the meeting point was never sent to the phone");
    assert.deepEqual(cmd.waypoints.waypoints.map((w) => w.desc), ["Nhà", "Điểm hẹn"]);
    assert.equal(cmd.waypoints.waypoints[1].lat, 10.776);

    // The phone, asleep in a pocket, says it crossed into the meeting point.
    await post({ _type: "transition", event: "enter", wtst: REGION_MEET.tst, tst: Math.floor(Date.now() / 1000) - 5, acc: 20, t: "c", desc: "Điểm hẹn" });
    const told = sentTo(couple.b.userId, "arrive-meet");
    assert.equal(told.length, 1);
    assert.match(told[0].payload.title, /Hoa đã tới Cà phê Gió/);

    // Ending the trip takes the meeting point down.
    await couple.a.caller.location.endNavTrip({ inviteId: invite.id });
    const link = await TrackerLinkModel.findOne({ spaceId: couple.spaceId, userId: couple.a.userId }).lean<{ meet: unknown }>();
    assert.equal(link?.meet, null);
  });
});

describe("hai bạn đã gặp nhau, khi một người cất máy", () => {
  test("đang xa rồi tới gần: người cất máy nhận thông báo, người đang nhìn app thì app tự báo", async () => {
    const couple = await makeCouple({ a: "Lan", b: "Minh" });
    const post = await trackerFor(couple);
    const P = { lat: 10.77, lng: 106.69 };

    await couple.b.caller.location.pingLiveLocation({ lat: P.lat + 0.01, lng: P.lng });
    await post(fixAt(P.lat, P.lng, 60));
    assert.equal(sentTo(couple.a.userId, "met").length, 0, "being apart is not news");

    await couple.b.caller.location.pingLiveLocation({ lat: P.lat + 0.0002, lng: P.lng });
    await post(fixAt(P.lat, P.lng, 30));
    const toA = sentTo(couple.a.userId, "met");
    assert.equal(toA.length, 1);
    assert.match(toA[0].payload.body, /Bạn và Minh gặp nhau/);
    assert.equal(sentTo(couple.b.userId, "met").length, 0, "the open app's own flare already said it");

    await post(fixAt(P.lat, P.lng, 5));
    assert.equal(sentTo(couple.a.userId, "met").length, 1, "sitting together announced again");
  });
});

describe("chuyến đi tự ghi, và thời gian học từ chuyến thật", () => {
  test("nhà → quán: thành một chuyến có giờ từng điểm, tên quán đã lưu; mở lại không nhân đôi", async () => {
    const couple = await makeCouple({ a: "Nga", b: "Phuc" });
    await trackerFor(couple);
    // Inside one hour of the clock, so every square is learned for the same hour.
    const start = Math.floor((Date.now() - 3 * 3600_000) / 3600_000) * 3600_000 + 5 * 60_000;
    const pts: Array<{ at: number; lat: number; lng: number }> = [];
    // 20 minutes at home, 15 minutes riding 6 km north (6.7 m/s), 30 minutes at the café.
    for (let i = 0; i <= 48; i++) pts.push({ at: start + i * 25_000, lat: 10.8, lng: 106.7 });
    const leave = pts[pts.length - 1].at;
    const step = (6000 / 36) / 111_000;
    for (let i = 1; i <= 36; i++) pts.push({ at: leave + i * 25_000, lat: 10.8 + i * step, lng: 106.7 });
    const arrive = pts[pts.length - 1];
    for (let i = 1; i <= 72; i++) pts.push({ at: arrive.at + i * 25_000, lat: arrive.lat, lng: arrive.lng });
    await TrackPointModel.insertMany(pts.map((p) => ({ spaceId: couple.spaceId, userId: couple.a.userId, at: new Date(p.at), lat: p.lat, lng: p.lng })));
    await LocationModel.create({ spaceId: couple.spaceId, name: "Trà sữa Mây", district: "Thủ Đức", category: "Cà phê", createdBy: couple.a.userId, geo: { lat: arrive.lat, lng: arrive.lng } });

    const list = await couple.b.caller.ride.list();
    assert.equal(list.items.length, 1);
    const ride = list.items[0];
    assert.equal(ride.source, "tracker");
    assert.equal(ride.userId, couple.a.userId);
    assert.equal(ride.destinationName, "Trà sữa Mây");
    assert.ok(Math.abs(ride.distanceMeters - 6000) < 200, `distance ${ride.distanceMeters}`);
    assert.equal(ride.durationSeconds, 15 * 60);

    const doc = await RideModel.findOne({ spaceId: couple.spaceId }).lean<{ path: number[][]; pathAt: number[] }>();
    assert.equal(doc?.pathAt.length, doc?.path.length, "the trail has no times");

    assert.equal((await couple.b.caller.ride.list()).items.length, 1, "opening the list again saved the trip twice");

    // What the ride taught: the map says 5 minutes for this road, they took 15.
    // One ride moves the estimate part of the way — it may have been a wet day.
    assert.ok((await SpeedCellModel.countDocuments({ spaceId: couple.spaceId })) > 0);
    const line = pts.slice(48, 85).map((p) => [p.lng, p.lat] as [number, number]);
    const once = (await routeTimer(couple.spaceId, [line], leave))(line, 300);
    assert.ok(once.seconds > 500 && once.seconds < 750, `after one ride ${once.seconds}s`);
    // Twenty rides like it, and the map's number is all but replaced by theirs.
    await SpeedCellModel.updateMany({ spaceId: couple.spaceId }, { $mul: { m: 20, s: 20 } });
    const many = (await routeTimer(couple.spaceId, [line], leave))(line, 300);
    assert.ok(many.learnedShare > 0.85, `share ${many.learnedShare}`);
    assert.ok(Math.abs(many.seconds - 900) < 60, `after twenty rides ${many.seconds}s`);

    // Another couple's history is not theirs.
    const other = await makeCouple({ a: "Quan", b: "Son" });
    const theirs = await routeTimer(other.spaceId, [line], leave);
    assert.equal(theirs(line, 300).seconds, 300);
  });
});
