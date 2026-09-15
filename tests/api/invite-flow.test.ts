/*
 * Getting the other person in.
 *
 * The old flow was ten characters of a confusable alphabet, read off one phone
 * and typed into another — and every way it could fail said the same sentence:
 * "mã không hợp lệ hoặc đã hết hạn". That is wrong for three of the four
 * failures, and it sends people to ask for a new code that would not have
 * helped them.
 *
 * So the four endings are now four answers, and this file is where that is
 * held true. The join itself stays a single atomic update — it was race-free
 * and must stay race-free — so the extra read only happens once it has already
 * failed.
 */
import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  freshDatabase, closeDatabase, makeMember, makeUser, makeCouple,
  callerFor, rejects, must,
} from "./_harness.ts";

before(freshDatabase);
after(closeDatabase);

const spaces = () => mongoose.connection.collection("spaces");

/** Sign a fresh person in, with no space of their own yet. */
async function stranger(name: string) {
  const u = await makeUser({ name });
  return { ...u, caller: callerFor({ userId: u.id, userEmail: u.email }) };
}

describe("making an invitation", () => {
  test("it hands back a link, a code and when it dies", async () => {
    /*
     * A path rather than a URL: the browser supplies the origin, so an invite
     * created on a preview deployment or a laptop points at THAT app. The QR
     * and the copy button read one value, so they still cannot disagree.
     */
    const me = await makeMember({ name: "Host" });
    const invite = await me.caller.space.createInvite();

    assert.match(invite.code, /^[A-Z0-9]{10}$/, "still a readable code for reading aloud");
    assert.equal(invite.path, `/moi/${invite.code}`, "the path carries THIS code");
    assert.ok(
      !invite.path.startsWith("http"),
      "a PATH, not an origin: the browser supplies that, or an invite made on a " +
        "laptop points at production where the code does not exist",
    );
    assert.ok(invite.expiresAt instanceof Date);
    assert.ok(invite.expiresAt.getTime() > Date.now(), "and it is alive when handed over");
    assert.equal(invite.spaceName, "Góc của Host");
  });

  test("making a new one kills the old one", async () => {
    // "Tạo mã mới" has to mean the old link stops working, or a code shared by
    // accident stays live for a week.
    const me = await makeMember({ name: "Rotate" });
    const first = await me.caller.space.createInvite();
    const second = await me.caller.space.createInvite();
    assert.notEqual(first.code, second.code);

    const guest = await stranger("Guest");
    await rejects(() => guest.caller.space.joinByCode({ code: first.code }), "BAD_REQUEST");
    await assert.doesNotReject(() => guest.caller.space.joinByCode({ code: second.code }));
  });

  test("a full space cannot invite a third person", async () => {
    const { a } = await makeCouple({ a: "FullA", b: "FullB" });
    await rejects(() => a.caller.space.createInvite(), "CONFLICT");
  });

  test("a signed-out caller cannot make one", async () => {
    await rejects(() => callerFor().space.createInvite(), "UNAUTHORIZED");
  });
});

describe("what the link says before anybody signs up", () => {
  /*
   * The preview is public on purpose. Somebody arriving from a message has no
   * account and no idea what this app is; a login wall with no context is
   * where invitations die. It returns a name and a status, nothing else — no
   * ids, no members, and it cannot be used to join.
   */
  test("a live invitation names the space, with no session at all", async () => {
    const me = await makeMember({ name: "Preview", spaceName: "Góc của hai đứa" });
    const { code } = await me.caller.space.createInvite();

    const seen = await callerFor().space.previewInvite({ code });
    assert.equal(seen.status, "open");
    assert.equal(seen.spaceName, "Góc của hai đứa");
  });

  test("it never leaks who is in the space", async () => {
    const me = await makeMember({ name: "Private" });
    const { code } = await me.caller.space.createInvite();
    const seen = await callerFor().space.previewInvite({ code });
    assert.deepEqual(Object.keys(seen).sort(), ["spaceName", "status"]);
  });

  test("a code nobody ever issued is unknown, not an error", async () => {
    const seen = await callerFor().space.previewInvite({ code: "ZZZZZZZZZZ" });
    assert.equal(seen.status, "unknown");
    assert.equal(seen.spaceName, null, "and it does not invent a name");
  });

  test("an expired invitation says expired, before anybody tries it", async () => {
    // So the screen can say "nhờ người kia tạo mã mới" on arrival rather than
    // after a failed attempt.
    const me = await makeMember({ name: "Stale" });
    const { code } = await me.caller.space.createInvite();
    await spaces().updateOne(
      { _id: new mongoose.Types.ObjectId(me.spaceId) },
      { $set: { inviteCodeExpiresAt: new Date(Date.now() - 1000) } },
    );
    const seen = await callerFor().space.previewInvite({ code });
    assert.equal(seen.status, "expired");
    assert.equal(seen.spaceName, "Góc của Stale", "it still says whose, so the message can be kind");
  });

  test("a space that filled up while the link travelled says full", async () => {
    const me = await makeMember({ name: "Filling" });
    const { code } = await me.caller.space.createInvite();
    const quick = await stranger("Quick");
    await quick.caller.space.joinByCode({ code });

    // The code is spent by the join, so re-issue to test the "full" branch on
    // a live code — which is what a second invite link would be.
    await spaces().updateOne(
      { _id: new mongoose.Types.ObjectId(me.spaceId) },
      {
        $set: {
          inviteCodeHash: await hashOf(code),
          inviteCodeExpiresAt: new Date(Date.now() + 60_000),
        },
      },
    );
    const seen = await callerFor().space.previewInvite({ code });
    assert.equal(seen.status, "full");
  });
});

/** The server hashes codes before storing them; the test needs the same hash. */
async function hashOf(code: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(code).digest("hex");
}

describe("accepting it", () => {
  test("the happy path puts them in the same space", async () => {
    const me = await makeMember({ name: "Owner", spaceName: "Nhà mình" });
    const { code } = await me.caller.space.createInvite();
    const guest = await stranger("Partner");

    const joined = await guest.caller.space.joinByCode({ code });
    assert.equal(joined.id, me.spaceId, "the space they were invited to, not a new one");

    const row = must(await spaces().findOne({ _id: new mongoose.Types.ObjectId(me.spaceId) }));
    assert.deepEqual([...row.members].sort(), [me.userId, guest.id].sort());
    assert.equal(row.inviteCodeHash, undefined, "and the code is spent");
  });

  test("the same link cannot be used twice", async () => {
    const me = await makeMember({ name: "Once" });
    const { code } = await me.caller.space.createInvite();
    const first = await stranger("First");
    const second = await stranger("Second");

    await first.caller.space.joinByCode({ code });
    await rejects(() => second.caller.space.joinByCode({ code }), "BAD_REQUEST");
  });

  test("somebody already in the space is TOLD that, not sent away", async () => {
    /*
     * The failure this whole change is about. Re-opening your own invite link
     * used to say "mã không hợp lệ hoặc đã hết hạn", which is both false and
     * alarming — you are already where the link was taking you.
     */
    const me = await makeMember({ name: "Already" });
    const { code } = await me.caller.space.createInvite();
    const err = await rejects(() => me.caller.space.joinByCode({ code }), "CONFLICT");
    assert.equal(err.message, "ALREADY_MEMBER");
  });

  test("an expired code says expired, not invalid", async () => {
    const me = await makeMember({ name: "Expired" });
    const { code } = await me.caller.space.createInvite();
    await spaces().updateOne(
      { _id: new mongoose.Types.ObjectId(me.spaceId) },
      { $set: { inviteCodeExpiresAt: new Date(Date.now() - 1000) } },
    );
    const guest = await stranger("Late");
    const err = await rejects(() => guest.caller.space.joinByCode({ code }), "BAD_REQUEST");
    assert.equal(err.message, "EXPIRED_CODE", "so the screen can say 'ask for a new one'");
  });

  test("a third person is told the space is full", async () => {
    const me = await makeMember({ name: "Two" });
    const { code } = await me.caller.space.createInvite();
    const second = await stranger("SecondPerson");
    await second.caller.space.joinByCode({ code });

    // Re-arm the same code so a third person meets a LIVE code on a full space.
    await spaces().updateOne(
      { _id: new mongoose.Types.ObjectId(me.spaceId) },
      { $set: { inviteCodeHash: await hashOf(code), inviteCodeExpiresAt: new Date(Date.now() + 60_000) } },
    );
    const third = await stranger("ThirdPerson");
    const err = await rejects(() => third.caller.space.joinByCode({ code }), "CONFLICT");
    assert.equal(err.message, "SPACE_FULL");
  });

  test("a code that never existed is invalid", async () => {
    const guest = await stranger("Wrong");
    const err = await rejects(
      () => guest.caller.space.joinByCode({ code: "QQQQQQQQQQ" }),
      "BAD_REQUEST",
    );
    assert.equal(err.message, "INVALID_OR_EXPIRED_CODE");
  });

  test("a signed-out caller cannot join", async () => {
    const me = await makeMember({ name: "Guarded" });
    const { code } = await me.caller.space.createInvite();
    await rejects(() => callerFor().space.joinByCode({ code }), "UNAUTHORIZED");
  });

  test("two people racing the same link: exactly one gets in", async () => {
    /*
     * The reason the join is one atomic update rather than a read followed by
     * a write. Both requests match the same live code; the database decides,
     * and the loser is told why rather than silently added to a full space.
     */
    const me = await makeMember({ name: "Race" });
    const { code } = await me.caller.space.createInvite();
    const a = await stranger("RacerA");
    const b = await stranger("RacerB");

    const results = await Promise.allSettled([
      a.caller.space.joinByCode({ code }),
      b.caller.space.joinByCode({ code }),
    ]);
    const won = results.filter((r) => r.status === "fulfilled");
    assert.equal(won.length, 1, "exactly one join may succeed");

    const row = must(await spaces().findOne({ _id: new mongoose.Types.ObjectId(me.spaceId) }));
    assert.equal(row.members.length, 2, "and the space holds two people, never three");
  });
});

describe("the space they land in", () => {
  test("joining gives them the other person's data, not an empty app", async () => {
    /*
     * A new member already has a personal space of their own, so landing in
     * the WRONG one looks exactly like the invitation not having worked. The
     * client sets the active-space cookie from the id returned here; this
     * pins that the id is the invited space and that its contents are visible.
     */
    const me = await makeMember({ name: "Furnished", spaceName: "Có đồ" });
    await mongoose.connection.collection("locations").insertOne({
      spaceId: me.spaceId, name: "Quán quen", district: "Phường Sài Gòn",
      category: "Cà phê", status: "want_to_go", source: "user",
      createdBy: me.userId, createdAt: new Date(), updatedAt: new Date(),
    });
    const { code } = await me.caller.space.createInvite();

    const guest = await stranger("NewMember");
    const { id } = await guest.caller.space.joinByCode({ code });

    const asMember = callerFor({ userId: guest.id, userEmail: guest.email, activeSpaceId: id });
    const places = await asMember.location.list();
    assert.equal(places.length, 1);
    assert.equal(places[0].name, "Quán quen");
  });

  test("a birthday row is seeded for the person who joined", async () => {
    // Existing behaviour, pinned here because the invite flow is now the main
    // way anybody joins and a silent failure would be invisible.
    const me = await makeMember({ name: "Cake" });
    const { code } = await me.caller.space.createInvite();
    const guest = await stranger("Birthday");
    await guest.caller.space.joinByCode({ code });

    const rows = await mongoose.connection.collection("specialdates")
      .countDocuments({ spaceId: me.spaceId });
    assert.ok(rows > 0, "joining seeds the shared calendar");
  });
});
