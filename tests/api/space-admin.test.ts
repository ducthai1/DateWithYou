/*
 * The space itself: who is in it, what they are called, and what happens when
 * it is deleted.
 *
 * Two of these are irreversible and one is a ratchet.
 *
 * `delete` is the only destructive procedure in the app, gated on being the
 * creator AND knowing the PIN (or typing the name when there is none). Every
 * one of those gates is checked here, because a wrong one is not a bug report
 * — it is somebody's memories gone.
 *
 * The member-profile writes are merges, not replaces: saving a nickname used
 * to erase the avatar the same person had chosen. Merging is invisible right
 * until the field you did not send comes back empty.
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { freshDatabase, closeDatabase, callerFor, makeCouple, makeMember, must, rejects } from "./_harness.ts";

let couple: Awaited<ReturnType<typeof makeCouple>>;
let outsider: Awaited<ReturnType<typeof makeMember>>;

before(async () => {
  await freshDatabase();
  couple = await makeCouple({ a: "An", b: "Binh" });
  outsider = await makeMember({ name: "Chi", spaceName: "Góc khác" });
});

after(closeDatabase);

const memberOf = async (userId: string) =>
  must((await couple.a.caller.space.members()).find((m) => m.id === userId), "member row");

describe("who is in the space", () => {
  test("both members come back, each told which one is them", async () => {
    const rows = await couple.a.caller.space.members();
    assert.equal(rows.length, 2);
    assert.equal(must(rows.find((r) => r.isSelf), "self row").id, couple.a.userId);
    assert.deepEqual(rows.map((r) => r.accountName).sort(), ["An", "Binh"]);
  });

  test("the reaction bar is always a full, valid row", async () => {
    // The client must never have to decide what to show when the stored list
    // is short or holds an emoji that has since been retired.
    const me = await memberOf(couple.a.userId);
    assert.equal(me.reactionBar.length, 6);
    assert.ok(me.reactionBar.every((e) => typeof e === "string" && e.length > 0));
  });

  test("gender is read off the account, not the space", async () => {
    assert.equal((await memberOf(couple.a.userId)).gender, "female");
    assert.equal((await memberOf(couple.b.userId)).gender, "male");
  });
});

describe("nicknames", () => {
  test("a nickname is shared, and the account name is kept beside it", async () => {
    await couple.a.caller.space.setNickname({ userId: couple.b.userId, nickname: "Bé" });
    const asSeenByA = await memberOf(couple.b.userId);
    assert.equal(asSeenByA.name, "Bé");
    assert.equal(asSeenByA.nickname, "Bé");
    assert.equal(asSeenByA.accountName, "Binh", "the settings field must know whose nickname it edits");

    // Both people see the same one — it is not a private label.
    const asSeenByB = must(
      (await couple.b.caller.space.members()).find((m) => m.id === couple.b.userId),
      "member row",
    );
    assert.equal(asSeenByB.name, "Bé");
  });

  test("blank brings the account's own name back", async () => {
    await couple.a.caller.space.setNickname({ userId: couple.b.userId, nickname: "  " });
    const row = await memberOf(couple.b.userId);
    assert.equal(row.nickname, null);
    assert.equal(row.name, "Binh");
  });

  test("a stranger cannot be renamed", async () => {
    await rejects(
      () => couple.a.caller.space.setNickname({ userId: outsider.userId, nickname: "Ai đó" }),
      "FORBIDDEN",
    );
  });
});

describe("a member's own profile", () => {
  test("each write edits only what it was given", async () => {
    /*
     * This used to build a fresh object from `input` alone, so saving the
     * reaction bar erased the avatar emoji and colour chosen earlier.
     */
    await couple.a.caller.space.setMemberProfile({ avatarEmoji: "🐰", avatarColor: "#b08968" });
    await couple.a.caller.space.setMemberProfile({ reactionFavourites: ["❤️", "😂"] });

    const me = await memberOf(couple.a.userId);
    assert.equal(me.avatarEmoji, "🐰", "the avatar must survive a reaction-bar save");
    assert.equal(me.avatarColor, "#b08968");
    assert.deepEqual(me.reactionBar.slice(0, 2), ["❤️", "😂"]);
  });

  test("a nickname is not settable through this door", async () => {
    // setNickname owns that field alone, so there is never a second path
    // writing it — the shape refuses it outright.
    await couple.a.caller.space.setNickname({ userId: couple.a.userId, nickname: "Anh" });
    await couple.a.caller.space.setMemberProfile({ avatarEmoji: "🐻" });
    const me = await memberOf(couple.a.userId);
    assert.equal(me.nickname, "Anh", "a profile save must not clear the nickname");
    assert.equal(me.avatarEmoji, "🐻");
  });

  test("a colour has to be a six-digit hex, and the bar is bounded", async () => {
    await rejects(() => couple.a.caller.space.setMemberProfile({ avatarColor: "đỏ" }), "BAD_REQUEST");
    await rejects(() => couple.a.caller.space.setMemberProfile({ avatarColor: "#fff" }), "BAD_REQUEST");
    await rejects(
      () =>
        couple.a.caller.space.setMemberProfile({
          reactionFavourites: ["❤️", "😂", "🔥", "👏", "😍", "🥹", "🥰"],
        }),
      "BAD_REQUEST",
    );
  });
});

describe("the tag palette", () => {
  test("a custom tag joins the built-in defaults", async () => {
    const before_ = await couple.a.caller.space.tags();
    await couple.a.caller.space.addTag({ name: "Sinh nhật", color: "#c98474" });
    const after_ = await couple.a.caller.space.tags();
    assert.equal(after_.length, before_.length + 1);
    assert.ok(after_.some((t) => t.name === "Sinh nhật"));
    assert.ok(
      before_.every((d) => after_.some((t) => t.name === d.name)),
      "the defaults must still be there",
    );
  });

  test("quick-add twice is one tag, whatever the casing", async () => {
    const before_ = (await couple.a.caller.space.tags()).length;
    await couple.a.caller.space.addTag({ name: "sinh nhật", color: "#000000" });
    await couple.a.caller.space.addTag({ name: "SINH NHẬT", color: "#ffffff" });
    assert.equal((await couple.a.caller.space.tags()).length, before_);
  });

  test("re-adding a built-in name does not double it up on the palette", async () => {
    // "Hẹn hò" is already a default. addTag only compares against the space's
    // OWN tags, so it stores one — and the read path drops it again, keeping
    // the default's colour. What must never happen is two "Hẹn hò" chips.
    const before_ = await couple.a.caller.space.tags();
    await couple.a.caller.space.addTag({ name: "Hẹn hò", color: "#123456" });
    const after_ = await couple.a.caller.space.tags();
    assert.equal(after_.length, before_.length);
    assert.equal(after_.filter((t) => t.name === "Hẹn hò").length, 1);
  });

  test("a colour that is not a hex is refused", async () => {
    await rejects(() => couple.a.caller.space.addTag({ name: "Sai", color: "xanh" }), "BAD_REQUEST");
  });
});

describe("the theme", () => {
  test("a preset from the registry is accepted and read back", async () => {
    await couple.a.caller.space.updateTheme({ themePreset: "ocean" });
    assert.equal(must(await couple.a.caller.space.getMine(), "space").themePreset, "ocean");
  });

  test("an invented preset never reaches the database", async () => {
    await rejects(() => couple.a.caller.space.updateTheme({ themePreset: "neon" }), "BAD_REQUEST");
    assert.equal(must(await couple.a.caller.space.getMine(), "space").themePreset, "ocean");
  });

  test("it writes to the ACTIVE space, not whichever one matched first", async () => {
    /*
     * A person in two spaces editing settings was previously writing to
     * whichever space matched {members} first — silently renaming the wrong
     * one.
     */
    const second = await callerFor({ userId: couple.a.userId, userEmail: couple.a.email }).space.create({
      name: "Góc thứ hai",
    });
    const inSecond = callerFor({
      userId: couple.a.userId,
      userEmail: couple.a.email,
      activeSpaceId: second.id,
    });
    await inSecond.space.updateTheme({ themePreset: "sage", name: "Đổi tên góc hai" });

    assert.equal(must(await inSecond.space.getMine(), "space").name, "Đổi tên góc hai");
    const first = must(await couple.a.caller.space.getMine(), "space");
    assert.equal(first.themePreset, "ocean", "the other space must be untouched");
    assert.notEqual(first.name, "Đổi tên góc hai");
  });
});

describe("the delete PIN", () => {
  test("only the creator may set it", async () => {
    await rejects(() => couple.b.caller.space.setPin({ pin: "1234" }), "FORBIDDEN");
  });

  test("setting and clearing is reported back", async () => {
    assert.deepEqual(await couple.a.caller.space.setPin({ pin: "1234" }), { ok: true, hasPin: true });
    assert.equal(must(await couple.a.caller.space.getMine(), "space").hasPin, true);
    assert.deepEqual(await couple.a.caller.space.setPin({ pin: "" }), { ok: true, hasPin: false });
    assert.equal(must(await couple.a.caller.space.getMine(), "space").hasPin, false);
  });
});

describe("deleting a space", () => {
  /** A couple with one row in every feature, so the cascade has work to do. */
  async function furnished(name: string) {
    const c = await makeCouple({ a: `Chu-${name}`, b: `Ban-${name}`, spaceName: name });
    const loc = await c.a.caller.location.create({
      name: "Quán quen",
      district: "Phường Sài Gòn",
      category: "Cà phê",
    });
    const mem = await c.a.caller.memory.create({ title: "Kỷ niệm", date: new Date("2026-03-03") });
    await c.a.caller.media.create({ kind: "music", title: "Bài hát", tags: [] });
    await c.a.caller.planItem.create({ title: "Đi ăn", date: "2026-03-03", bucket: "noon" });
    await c.a.caller.specialDate.create({ title: "Ngày riêng", date: "2026-03-03" });
    await c.a.caller.wishlist.create({ itemName: "Quà" });
    await c.a.caller.plan.create({ title: "Dự định" });
    await c.a.caller.capsule.create({
      title: "Thư",
      message: "Gửi mai sau",
      unlockDate: new Date("2030-01-01"),
    });
    await c.a.caller.cycle.addStart({ date: "2026-03-01" });
    await c.a.caller.interaction.react({ targetType: "memory", targetId: mem.id, emoji: "❤️" });
    await c.a.caller.interaction.addNote({ targetType: "memory", targetId: mem.id, body: "Ghi chú" });
    const task = await c.a.caller.reward.createTask({ title: "Việc", points: 10 });
    await c.a.caller.reward.completeTask({ taskId: task.id, forUserId: c.a.userId });
    await c.a.caller.reward.createVoucher({ title: "Thưởng", cost: 5 });
    await c.a.caller.location.pingLiveLocation({ lat: 10.77, lng: 106.7 });
    await c.a.caller.location.sendNavInvite({ locationId: loc.id, locationName: "Quán quen" });
    const trip = await c.a.caller.trip.create({
      title: "Chuyến đi",
      startDate: "2026-04-01",
      endDate: "2026-04-03",
    });
    await c.a.caller.trip.addChecklist({ tripId: trip.id, content: "Mang dù" });
    await c.a.caller.ride.record({
      destinationName: "Quán quen",
      startedAt: new Date("2026-03-03T10:00:00Z"),
      endedAt: new Date("2026-03-03T10:20:00Z"),
      distanceMeters: 4200,
      durationSeconds: 1200,
      path: [
        [106.7, 10.77],
        [106.71, 10.78],
      ],
    });
    return c;
  }

  /** Every collection still holding a row for this space. */
  async function leftovers(spaceId: string): Promise<string[]> {
    const names = (await mongoose.connection.db!.listCollections().toArray()).map((c) => c.name);
    const found: string[] = [];
    for (const name of names) {
      const n = await mongoose.connection.db!.collection(name).countDocuments({ spaceId });
      if (n > 0) found.push(name);
    }
    return found.sort();
  }

  test("the partner cannot delete it, only the person who opened it", async () => {
    const c = await furnished("Góc của người khác xoá");
    await rejects(() => c.b.caller.space.delete({ confirmName: "Góc của người khác xoá" }), "FORBIDDEN");
    assert.ok(await c.a.caller.space.getMine(), "the space must still be there");
  });

  test("without a PIN, the name has to be typed exactly", async () => {
    const c = await furnished("Góc gõ tên");
    await rejects(() => c.a.caller.space.delete({}), "FORBIDDEN");
    await rejects(() => c.a.caller.space.delete({ confirmName: "góc gõ tên" }), "FORBIDDEN");
    assert.ok(await c.a.caller.space.getMine());
    await c.a.caller.space.delete({ confirmName: "Góc gõ tên" });
    assert.equal(await c.a.caller.space.getMine(), null);
  });

  test("with a PIN, the name is not enough — and a wrong PIN is refused", async () => {
    const c = await furnished("Góc có PIN");
    await c.a.caller.space.setPin({ pin: "2468" });
    await rejects(() => c.a.caller.space.delete({ confirmName: "Góc có PIN" }), "FORBIDDEN");
    await rejects(() => c.a.caller.space.delete({ pin: "1357" }), "FORBIDDEN");
    await rejects(() => c.a.caller.space.delete({ pin: "" }), "FORBIDDEN");
    assert.ok(await c.a.caller.space.getMine());
    await c.a.caller.space.delete({ pin: " 2468 " });
    assert.equal(await c.a.caller.space.getMine(), null);
  });

  test("deleting takes every space-scoped row with it", async () => {
    /*
     * Nothing may survive — checked by sweeping the whole database, not by
     * re-reading the list the cascade itself uses.
     *
     * `delete-space-cascade.ts` names the collections to clear by hand, and
     * its own comment says adding a feature collection must be a deliberate
     * edit to that list "and can never be silently left behind on delete".
     * Three had been left behind anyway — the cycle log, then trips and
     * rides, the last two found by exactly this sweep. A test that read the
     * same list would have agreed with it and proved nothing; asking the
     * database what is actually left is what catches the next one.
     */
    const c = await furnished("Góc sẽ xoá sạch");
    const spaceId = c.spaceId;
    const wrote = await leftovers(spaceId);
    assert.ok(wrote.length > 10, `the fixture must write across the app (wrote to ${wrote.length})`);

    await c.a.caller.space.delete({ confirmName: "Góc sẽ xoá sạch" });

    assert.deepEqual(
      await leftovers(spaceId),
      [],
      "a collection is missing from SPACE_SCOPED_MODELS in delete-space-cascade.ts",
    );
    assert.equal(await c.a.caller.space.getMine(), null, "the space document itself is gone");
  });

  test("a space that is gone is gone for both people", async () => {
    const c = await furnished("Góc xoá cho cả hai");
    await c.a.caller.space.delete({ confirmName: "Góc xoá cho cả hai" });
    /*
     * NO_SPACE, not STALE_SPACE: the partner now belongs to no space at all,
     * and membership is resolved before the active-space cookie is looked at.
     * The stale-cookie path is for somebody who still has other spaces.
     */
    const err = await rejects(() => c.b.caller.location.list({}), "FORBIDDEN");
    assert.equal(err.message, "NO_SPACE");
    assert.equal(await c.b.caller.space.getMine(), null);
  });
});
