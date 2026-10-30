/*
 * The background tracker (OwnTracks) end to end, minus the phone: link it,
 * post what it posts, and check the partner sees it — or does not, when it
 * should not.
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, closeDatabase, makeCouple } from "./_harness.ts";
import { POST } from "@/app/api/track/owntracks/route";
import { LiveLocationModel } from "@/server/db/models/live-location";
import { TRACKER_INTERVAL_S } from "@/lib/owntracks";

let couple: Awaited<ReturnType<typeof makeCouple>>;
let creds: { url: string; username: string; password: string; locatorInterval: number; moveModeLocatorInterval: number };

before(async () => {
  await freshDatabase();
  couple = await makeCouple({ a: "An", b: "Binh" });
});
after(closeDatabase);

const decode = (link: string) =>
  JSON.parse(Buffer.from(decodeURIComponent(link.split("inline=")[1]), "base64").toString("utf8"));

function post(body: unknown, auth = `${creds.username}:${creds.password}`) {
  return POST(
    new Request("http://localhost/api/track/owntracks", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Basic ${Buffer.from(auth).toString("base64")}` },
      body: JSON.stringify(body),
    }),
  );
}

const fix = (secondsAgo: number, extra: Record<string, unknown> = {}) => ({
  _type: "location", lat: 10.8, lon: 106.75, tst: Math.floor(Date.now() / 1000) - secondsAgo, acc: 12, vel: 31, cog: 90, batt: 64, m: 2, tid: "VV", ...extra,
});

describe("linking", () => {
  test("the one-tap link carries a working login and the 25-second rhythm", async () => {
    const view = await couple.a.caller.tracker.connect();
    assert.equal(view.linked, true);
    assert.ok(view.linked && view.configLink.startsWith("owntracks:///config?inline="));
    creds = decode(view.linked ? view.configLink : "");
    assert.match(creds.url, /\/api\/track\/owntracks$/);
    assert.equal(creds.locatorInterval, TRACKER_INTERVAL_S);
    assert.equal(creds.moveModeLocatorInterval, TRACKER_INTERVAL_S);
  });

  test("linking again is the same link — a double tap cannot orphan the tracker", async () => {
    const again = await couple.a.caller.tracker.connect();
    assert.ok(again.linked);
    assert.equal(decode(again.configLink).password, creds.password);
  });
});

describe("what the tracker posts", () => {
  test("a wrong password is refused", async () => {
    assert.equal((await post(fix(0), `${creds.username}:nope`)).status, 401);
    assert.equal((await post(fix(0), "not-an-id:x")).status, 401);
  });

  test("a fresh fix becomes the position the partner sees, marked as the tracker's", async () => {
    const res = await post(fix(3));
    assert.equal(res.status, 200);
    const reply = (await res.json()) as Array<{ _type: string; action?: string }>;
    assert.ok(reply.some((m) => m._type === "cmd" && m.action === "status"), "never asked which permissions it has");

    const seen = await couple.b.caller.location.pingLiveLocation({ lat: 10.77, lng: 106.7 });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].userId, couple.a.userId);
    assert.equal(seen[0].lat, 10.8);
    assert.equal(seen[0].source, "tracker");
    assert.equal(seen[0].batteryLevel, 64, "the tracker can send an iPhone's battery, which Safari never could");
  });

  test("a queue flushed after a tunnel does not move the dot into the past", async () => {
    await post(fix(600, { lat: 11.5 }));
    const row = await LiveLocationModel.findOne({ spaceId: couple.spaceId, userId: couple.a.userId }).lean<{ lat: number }>();
    assert.equal(row?.lat, 10.8);
  });

  test("the app on screen wins over the tracker for a few seconds", async () => {
    await couple.a.caller.location.pingLiveLocation({ lat: 10.9, lng: 106.8 });
    await post(fix(0, { lat: 12 }));
    const row = await LiveLocationModel.findOne({ spaceId: couple.spaceId, userId: couple.a.userId }).lean<{ lat: number; source: string }>();
    assert.equal(row?.lat, 10.9);
    assert.equal(row?.source, "app");
  });

  test("its permission report reaches the setup screen", async () => {
    await post({ _type: "status", iOS: { locationManagerAuthorizationStatus: "authorizedWhenInUse", backgroundRefreshStatus: "available" } });
    const view = await couple.a.caller.tracker.status();
    assert.ok(view.linked);
    assert.equal(view.health?.platform, "ios");
    assert.equal(view.health?.location, "foreground");
    assert.ok(view.lastSeenAt, "lastSeenAt");
  });
});

describe("unlinking", () => {
  test("revokes the login and takes the tracker's dot down", async () => {
    await LiveLocationModel.updateOne({ spaceId: couple.spaceId, userId: couple.a.userId }, { $set: { source: "tracker" } });
    await couple.a.caller.tracker.disconnect();
    assert.equal((await post(fix(0))).status, 401);
    assert.equal(await LiveLocationModel.countDocuments({ spaceId: couple.spaceId, userId: couple.a.userId }), 0);
    const view = await couple.a.caller.tracker.status();
    assert.equal(view.linked, false);
  });
});
