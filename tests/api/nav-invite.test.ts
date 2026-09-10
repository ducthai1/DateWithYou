/*
 * "Cùng khởi hành" — the invite two people ride on.
 *
 * The parts worth pinning are the ones a single phone cannot show: that a
 * second invite retires the first rather than leaving two pending, that only
 * the person invited can answer and only once, that a sender is TOLD whether
 * the push reached a device instead of getting the same silence either way,
 * and that an invite id from another couple answers "expired" rather than
 * anything about their trip.
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, closeDatabase, makeCouple, makeMember, rejects } from "./_harness.ts";

let couple: Awaited<ReturnType<typeof makeCouple>>;
let other: Awaited<ReturnType<typeof makeCouple>>;

before(async () => {
  await freshDatabase();
  couple = await makeCouple({ a: "An", b: "Binh" });
  other = await makeCouple({ a: "Chi", b: "Dung", spaceName: "Góc khác" });
});

after(closeDatabase);

const send = (waypoints?: Array<{ lat: number; lng: number; name: string }>) =>
  couple.a.caller.location.sendNavInvite({
    locationId: "loc-1",
    locationName: "Quán cà phê",
    ...(waypoints ? { waypoints: waypoints.map((w) => ({ ...w, type: "custom" as const, status: "pending" as const })) } : {}),
  });

describe("sending", () => {
  test("a space with one person has nobody to invite", async () => {
    const alone = await makeMember({ name: "Solo" });
    await rejects(
      () => alone.caller.location.sendNavInvite({ locationId: "loc-1", locationName: "Quán" }),
      "BAD_REQUEST",
    );
  });

  test("the sender is told what happened to the push, not left guessing", async () => {
    /*
     * A send to somebody with no registered device used to return the same
     * nothing as a successful one, so an invite that could not possibly
     * arrive looked identical to one that did.
     */
    const res = await send();
    assert.ok(res.id);
    assert.ok(res.push, "the push outcome must be reported back");
    assert.ok(
      ["no-devices", "not-configured", "sent"].includes(res.push.reason),
      `unexpected push reason: ${res.push.reason}`,
    );
  });

  test("a second invite retires the first, so only one is ever pending", async () => {
    const first = await send();
    const second = await send();
    assert.notEqual(first.id, second.id);

    assert.equal((await couple.a.caller.location.sentInviteStatus({ inviteId: first.id })).status, "rejected");
    assert.equal((await couple.a.caller.location.sentInviteStatus({ inviteId: second.id })).status, "pending");

    // And the retired one can no longer be answered.
    await rejects(
      () => couple.b.caller.location.respondNavInvite({ inviteId: first.id, accept: true }),
      "NOT_FOUND",
    );
  });
});

describe("answering", () => {
  test("only the person invited may answer", async () => {
    const { id } = await send();
    await rejects(
      () => couple.a.caller.location.respondNavInvite({ inviteId: id, accept: true }),
      "NOT_FOUND",
    );
    assert.equal((await couple.a.caller.location.sentInviteStatus({ inviteId: id })).status, "pending");
  });

  test("accepting carries the waypoints back so both sides draw the same route", async () => {
    const { id } = await send([
      { lat: 10.77, lng: 106.7, name: "Chỗ Bình" },
      { lat: 10.78, lng: 106.71, name: "Quán cà phê" },
    ]);
    const accepted = await couple.b.caller.location.respondNavInvite({ inviteId: id, accept: true });
    assert.equal(accepted.status, "accepted");
    assert.deepEqual(
      accepted.waypoints.map((w) => w.name),
      ["Chỗ Bình", "Quán cà phê"],
    );

    // The sender polls for the same answer — the fallback for a dropped SSE frame.
    const polled = await couple.a.caller.location.sentInviteStatus({ inviteId: id });
    assert.equal(polled.status, "accepted");
    assert.equal(polled.waypoints.length, 2);
  });

  test("an invite is answered once", async () => {
    const { id } = await send();
    await couple.b.caller.location.respondNavInvite({ inviteId: id, accept: false });
    await rejects(
      () => couple.b.caller.location.respondNavInvite({ inviteId: id, accept: true }),
      "NOT_FOUND",
    );
    assert.equal((await couple.a.caller.location.sentInviteStatus({ inviteId: id })).status, "rejected");
  });

  test("a cancelled invite cannot be accepted afterwards", async () => {
    const { id } = await send();
    await couple.a.caller.location.cancelNavInvite({ inviteId: id });
    await rejects(
      () => couple.b.caller.location.respondNavInvite({ inviteId: id, accept: true }),
      "NOT_FOUND",
    );
  });
});

describe("ending a shared trip", () => {
  test("either partner may end it, and it is recorded who did", async () => {
    const { id } = await send();
    await couple.b.caller.location.respondNavInvite({ inviteId: id, accept: true });
    await couple.b.caller.location.endNavTrip({ inviteId: id });
    assert.equal((await couple.a.caller.location.sentInviteStatus({ inviteId: id })).status, "ended");
  });
});

describe("another couple", () => {
  test("cannot answer, cancel, end or even read the invite", async () => {
    const { id } = await send();
    await rejects(
      () => other.b.caller.location.respondNavInvite({ inviteId: id, accept: true }),
      "NOT_FOUND",
    );
    await other.a.caller.location.cancelNavInvite({ inviteId: id });
    await other.a.caller.location.endNavTrip({ inviteId: id });

    // Reading it answers "expired" — nothing about somebody else's trip.
    const seen = await other.a.caller.location.sentInviteStatus({ inviteId: id });
    assert.equal(seen.status, "expired");
    assert.equal(seen.locationName, null);

    // And none of that touched it.
    assert.equal((await couple.a.caller.location.sentInviteStatus({ inviteId: id })).status, "pending");
  });
});

describe("live location", () => {
  test("a ping answers with the partner's fresh fix, and never with your own", async () => {
    const alone = await couple.a.caller.location.pingLiveLocation({ lat: 10.77, lng: 106.7 });
    assert.deepEqual(alone, [], "nobody else has pinged yet");

    const seen = await couple.b.caller.location.pingLiveLocation({ lat: 10.78, lng: 106.71 });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].userId, couple.a.userId);
    assert.equal(seen[0].lat, 10.77);
  });

  test("a ping never carries another couple's position", async () => {
    await other.a.caller.location.pingLiveLocation({ lat: 21.02, lng: 105.83 });
    const seen = await other.b.caller.location.pingLiveLocation({ lat: 21.03, lng: 105.84 });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].userId, other.a.userId);
    assert.ok(
      !seen.some((p: { userId: string }) => p.userId === couple.a.userId),
      "a position leaked across spaces",
    );
  });
});
