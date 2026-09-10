/*
 * The bits that hang off a person or a device rather than the couple: rides
 * recorded when navigation ends, the push subscriptions of each phone, the
 * signed upload ticket, and the one fact stored on the account itself.
 *
 * Three things here are worth pinning. A ride's breadcrumb trail is SAMPLED
 * rather than truncated, because cutting from one end would lose the
 * destination — the point that matters most. The upload signature includes
 * the space's folder, which is what makes the folder a boundary instead of a
 * convention: a client cannot move its uploads into another couple's folder
 * without invalidating the ticket it was given. And gender is settable only
 * for yourself, even inside a shared space.
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, closeDatabase, callerFor, makeCouple, makeMember, must, rejects } from "./_harness.ts";

let couple: Awaited<ReturnType<typeof makeCouple>>;
let outsider: Awaited<ReturnType<typeof makeMember>>;

before(async () => {
  await freshDatabase();
  couple = await makeCouple({ a: "An", b: "Binh" });
  outsider = await makeMember({ name: "Chi", spaceName: "Góc khác" });
});

after(closeDatabase);

const ride = (over: Record<string, unknown> = {}) => ({
  destinationName: "Quán cà phê",
  startedAt: new Date("2026-03-03T10:00:00Z"),
  endedAt: new Date("2026-03-03T10:20:00Z"),
  distanceMeters: 4200,
  durationSeconds: 1200,
  path: [
    [106.7, 10.77],
    [106.71, 10.78],
  ] as [number, number][],
  ...over,
});

describe("rides", () => {
  test("a finished ride is stored and read back newest first", async () => {
    await couple.a.caller.ride.record(ride({ destinationName: "Chuyến một" }));
    await couple.b.caller.ride.record(
      ride({
        destinationName: "Chuyến hai",
        startedAt: new Date("2026-03-04T10:00:00Z"),
        endedAt: new Date("2026-03-04T10:30:00Z"),
      }),
    );
    const { items } = await couple.a.caller.ride.list();
    assert.deepEqual(
      items.map((r) => r.destinationName),
      ["Chuyến hai", "Chuyến một"],
    );
    assert.equal(items[0].userId, couple.b.userId, "the ride records who rode it");
  });

  test("the page carries a cursor only when there is more", async () => {
    const one = await couple.a.caller.ride.list({ limit: 1 });
    assert.equal(one.items.length, 1);
    assert.ok(one.nextCursor, "one of two rides means there is a next page");

    const rest = await couple.a.caller.ride.list({ limit: 1, before: one.nextCursor! });
    assert.equal(rest.items.length, 1);
    assert.equal(rest.items[0].destinationName, "Chuyến một");
    assert.equal(rest.nextCursor, null, "the last page must say so");
  });

  test("the totals add up over the space, not per person", async () => {
    const s = await couple.a.caller.ride.stats();
    assert.equal(s.count, 2);
    assert.equal(s.distanceMeters, 8400);
    assert.equal(s.durationSeconds, 2400);
  });

  test("a long trail is sampled down, keeping both ends", async () => {
    /*
     * Truncating from one end would cut a cross-town ride in half on the map,
     * and the far end is the destination. Sampling keeps the shape.
     */
    const path: [number, number][] = Array.from({ length: 5000 }, (_, i) => [
      106.7 + i / 100000,
      10.77 + i / 100000,
    ]);
    const { id } = await couple.a.caller.ride.record(
      ride({ destinationName: "Chuyến dài", path, startedAt: new Date("2026-03-05T08:00:00Z"), endedAt: new Date("2026-03-05T09:00:00Z") }),
    );

    const stored = must(
      await (await import("mongoose")).default.connection
        .collection("rides")
        .findOne({ _id: (await import("mongodb")).ObjectId.createFromHexString(id) }),
      "the stored ride",
    ) as unknown as { path: [number, number][] };
    assert.equal(stored.path.length, 2000, "capped at 2000 points");
    assert.deepEqual(stored.path[0], path[0], "the start is kept exactly");
    assert.deepEqual(stored.path[stored.path.length - 1], path[path.length - 1], "and so is the destination");
  });

  test("a ride that ends before it starts is refused", async () => {
    await rejects(
      () =>
        couple.a.caller.ride.record(
          ride({ startedAt: new Date("2026-03-03T11:00:00Z"), endedAt: new Date("2026-03-03T10:00:00Z") }),
        ),
      "BAD_REQUEST",
    );
  });

  test("a corrupt payload is bounded", async () => {
    // Not a limit on real rides — a guard against a bad GPS delta multiplying
    // into billions of metres or a stuck clock.
    await rejects(() => couple.a.caller.ride.record(ride({ distanceMeters: 3_000_000 })), "BAD_REQUEST");
    await rejects(() => couple.a.caller.ride.record(ride({ durationSeconds: 300_000 })), "BAD_REQUEST");
    await rejects(() => couple.a.caller.ride.record(ride({ destinationName: "  " })), "BAD_REQUEST");
  });

  test("another couple's rides are not in our history or our totals", async () => {
    await outsider.caller.ride.record(ride({ destinationName: "Chuyến của người khác" }));
    const { items } = await couple.a.caller.ride.list();
    assert.ok(!items.some((r) => r.destinationName === "Chuyến của người khác"));
    assert.equal((await couple.a.caller.ride.stats()).count, 3, "our three, not their fourth");
    assert.equal((await outsider.caller.ride.stats()).count, 1);
  });
});

describe("push subscriptions", () => {
  const sub = (endpoint: string) => ({
    endpoint,
    keys: { p256dh: "p".repeat(87), auth: "a".repeat(22) },
    userAgent: "test",
  });

  test("a device registers against the person, and the count says so", async () => {
    await couple.a.caller.push.subscribe(sub("https://push.example.test/an-1"));
    const mine = await couple.a.caller.push.available();
    if (mine.enabled) {
      assert.equal(mine.myDevices, 1);
      assert.equal(mine.partnerDevices, 0, "the partner has registered nothing yet");
    } else {
      // No VAPID keys configured here; the shape still has to be honest.
      assert.deepEqual(mine, { enabled: false, myDevices: 0, partnerDevices: 0 });
    }
  });

  test("each side sees the other's device count", async () => {
    await couple.b.caller.push.subscribe(sub("https://push.example.test/binh-1"));
    const seenByA = await couple.a.caller.push.available();
    if (!seenByA.enabled) return;
    assert.equal(seenByA.myDevices, 1);
    assert.equal(seenByA.partnerDevices, 1);
    const seenByOutsider = await outsider.caller.push.available();
    assert.equal(seenByOutsider.myDevices, 0, "a stranger's count is their own");
    assert.equal(seenByOutsider.partnerDevices, 0);
  });

  test("unsubscribing takes that one endpoint off", async () => {
    await couple.a.caller.push.unsubscribe({ endpoint: "https://push.example.test/an-1" });
    const mine = await couple.a.caller.push.available();
    if (!mine.enabled) return;
    assert.equal(mine.myDevices, 0);
    assert.equal(mine.partnerDevices, 1, "the partner's device must be untouched");
  });

  test("keys that could never be delivered to are refused on the way in", async () => {
    /*
     * The push spec fixes these sizes. A row failing them can never be
     * delivered to, so it would sit failing for ever without earning the 410
     * that prunes it.
     */
    await rejects(
      () =>
        couple.a.caller.push.subscribe({
          endpoint: "https://push.example.test/short",
          keys: { p256dh: "too-short", auth: "a".repeat(22) },
        }),
      "BAD_REQUEST",
    );
    await rejects(
      () =>
        couple.a.caller.push.subscribe({
          endpoint: "khong-phai-url",
          keys: { p256dh: "p".repeat(87), auth: "a".repeat(22) },
        }),
      "BAD_REQUEST",
    );
  });
});

describe("the upload ticket", () => {
  test("the folder in the signature is this space's, which is what makes it a boundary", async () => {
    const ticket = await couple.a.caller.upload.sign();
    assert.equal(ticket.folder, `memories/${couple.spaceId}`);
    assert.ok(ticket.signature && ticket.signature.length > 10);
    assert.ok(ticket.timestamp > 1_600_000_000, "a real unix timestamp in seconds");

    const theirs = await outsider.caller.upload.sign();
    assert.notEqual(theirs.folder, ticket.folder, "two spaces must never share a folder");
  });

  test("blog uploads are gated on the admin allowlist, not on space membership", async () => {
    await rejects(() => couple.a.caller.upload.signBlog(), "FORBIDDEN");
    await rejects(() => callerFor({}).upload.signBlog(), "UNAUTHORIZED");
  });
});

describe("the one fact on the account", () => {
  test("gender is read back from the account, not the space", async () => {
    assert.equal((await couple.a.caller.profile.me()).gender, "female");
    assert.equal((await couple.b.caller.profile.me()).gender, "male");
  });

  test("you may set your own, and only your own", async () => {
    // There is no procedure taking a userId at all — the shape itself is the
    // guarantee. Setting it changes the caller's account and nobody else's.
    await couple.b.caller.profile.setGender({ gender: "female" });
    assert.equal((await couple.b.caller.profile.me()).gender, "female");
    assert.equal((await couple.a.caller.profile.me()).gender, "female");
    await couple.b.caller.profile.setGender({ gender: "male" });
    assert.equal((await couple.b.caller.profile.me()).gender, "male");
  });

  test("an invented value is refused", async () => {
    await rejects(
      () => couple.a.caller.profile.setGender({ gender: "khac" as "male" }),
      "BAD_REQUEST",
    );
  });

  test("it needs a session but not a space", async () => {
    // authedProcedure, not protectedProcedure: this is asked during onboarding,
    // before the person has a space at all.
    const fresh = callerFor({ userId: "6aa2000000000000000000aa", userEmail: "moi@example.test" });
    assert.equal((await fresh.profile.me()).gender, null);
    await rejects(() => callerFor({}).profile.me(), "UNAUTHORIZED");
  });
});
