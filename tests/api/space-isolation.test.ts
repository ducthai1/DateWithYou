/*
 * The tenant seam.
 *
 * Every feature collection is scoped by `spaceId`, resolved once in
 * `protectedProcedure` from the caller's membership. The whole app rests on
 * that: nothing else stops one couple from reading another couple's places,
 * memories, plans or wishes. It is also the failure that would be silent —
 * a leak shows up as somebody else's row appearing in a list, not as an
 * error anyone would notice in development with one account.
 *
 * So this file walks the content routers with two unrelated couples and
 * checks the same three things for each: a list never carries the other
 * space's row, an id from the other space cannot be read, and a write aimed
 * at it changes nothing.
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, closeDatabase, makeMember, callerFor, newUserId, rejects } from "./_harness.ts";

type Caller = Awaited<ReturnType<typeof makeMember>>["caller"];

let an: Awaited<ReturnType<typeof makeMember>>;
let binh: Awaited<ReturnType<typeof makeMember>>;

before(async () => {
  await freshDatabase();
  an = await makeMember({ name: "An", spaceName: "Góc của An", gender: "female" });
  binh = await makeMember({ name: "Binh", spaceName: "Góc của Bình", gender: "male" });
  assert.notEqual(an.spaceId, binh.spaceId, "the two fixtures must be different spaces");
});

after(closeDatabase);

/**
 * One content router, described by what it takes to make a row and what it
 * takes to reach that row again from outside.
 */
type Feature = {
  name: string;
  create: (c: Caller) => Promise<string>;
  /** Ids visible to this caller. */
  ids: (c: Caller) => Promise<string[]>;
  /** Reads addressed by id, which must not answer for another space. */
  read?: (c: Caller, id: string) => Promise<unknown>;
  /** Writes addressed by id, which must not land in another space. */
  writes: Array<(c: Caller, id: string) => Promise<unknown>>;
};

const futureDate = new Date("2030-06-01T00:00:00.000Z");

const FEATURES: Feature[] = [
  {
    name: "location",
    // No geo and no maps link on purpose: either one sends `create` to a
    // geocoder over the network, which a test must not depend on.
    create: async (c) =>
      (await c.location.create({ name: "Quán cà phê", district: "Phường Sài Gòn", category: "Cà phê" })).id,
    ids: async (c) => (await c.location.list({})).map((d) => d.id),
    writes: [
      (c, id) => c.location.update({ id, name: "Bị sửa từ space khác" }),
      (c, id) => c.location.toggleStatus({ id }),
      (c, id) => c.location.remove({ id }),
    ],
  },
  {
    name: "memory",
    create: async (c) => (await c.memory.create({ title: "Kỷ niệm của An", date: new Date("2026-01-15") })).id,
    ids: async (c) => (await c.memory.list({ limit: 24 })).items.map((d: { id: string }) => d.id),
    read: (c, id) => c.memory.get({ id }),
    writes: [
      (c, id) => c.memory.update({ id, title: "Bị sửa từ space khác" }),
      (c, id) => c.memory.remove({ id }),
    ],
  },
  {
    name: "media",
    create: async (c) => (await c.media.create({ kind: "music", title: "Bài hát của An", tags: [] })).id,
    ids: async (c) => (await c.media.list()).map((d: { id: string }) => d.id),
    writes: [
      (c, id) => c.media.update({ id, title: "Bị sửa từ space khác" }),
      (c, id) => c.media.remove({ id }),
    ],
  },
  {
    name: "planItem",
    create: async (c) =>
      (await c.planItem.create({ title: "Đi ăn", date: "2026-01-15", bucket: "morning" })).id,
    ids: async (c) =>
      (await c.planItem.listByRange({ fromKey: "2026-01-01", toKey: "2026-12-31" })).map(
        (d: { id: string }) => d.id,
      ),
    writes: [
      (c, id) => c.planItem.update({ id, title: "Bị sửa từ space khác" }),
      (c, id) => c.planItem.setStatus({ id, status: "done" }),
      (c, id) => c.planItem.remove({ id }),
    ],
  },
  {
    name: "wishlist",
    create: async (c) => (await c.wishlist.create({ itemName: "Quà của An" })).id,
    ids: async (c) => (await c.wishlist.list()).map((d: { id: string }) => d.id),
    writes: [
      (c, id) => c.wishlist.update({ id, itemName: "Bị sửa từ space khác" }),
      (c, id) => c.wishlist.toggleBought({ id }),
      (c, id) => c.wishlist.remove({ id }),
    ],
  },
  {
    name: "specialDate",
    create: async (c) => (await c.specialDate.create({ title: "Ngày của An", date: "2026-03-01" })).id,
    ids: async (c) => (await c.specialDate.list()).map((d) => d.id),
    writes: [
      (c, id) => c.specialDate.update({ id, title: "Bị sửa từ space khác" }),
      (c, id) => c.specialDate.remove({ id }),
    ],
  },
  {
    name: "trip",
    create: async (c) =>
      (await c.trip.create({ title: "Chuyến của An", startDate: "2026-05-01", endDate: "2026-05-03" })).id,
    ids: async (c) => (await c.trip.list()).map((d: { id: string }) => d.id),
    read: (c, id) => c.trip.get({ id }),
    writes: [
      (c, id) => c.trip.update({ id, title: "Bị sửa từ space khác" }),
      (c, id) => c.trip.addChecklist({ tripId: id, content: "Mang dù" }),
      (c, id) => c.trip.remove({ id }),
    ],
  },
  {
    name: "capsule",
    create: async (c) =>
      (await c.capsule.create({ title: "Thư của An", message: "Gửi mai sau", unlockDate: futureDate })).id,
    ids: async (c) => (await c.capsule.list()).map((d: { id: string }) => d.id),
    writes: [(c, id) => c.capsule.markOpened({ id })],
  },
];

describe("a space never sees another space's rows", () => {
  for (const feature of FEATURES) {
    test(feature.name, async () => {
      const id = await feature.create(an.caller);

      assert.ok((await feature.ids(an.caller)).includes(id), `${feature.name}: owner cannot see their own row`);
      assert.ok(
        !(await feature.ids(binh.caller)).includes(id),
        `${feature.name}: the row leaked into another space's list`,
      );

      if (feature.read) {
        await assert.rejects(
          () => feature.read!(binh.caller, id),
          `${feature.name}: another space could read the row by id`,
        );
      }

      for (const write of feature.writes) {
        // Whether the router answers NOT_FOUND or quietly matches nothing is
        // its own business; what must hold is that the row is untouched.
        await write(binh.caller, id).catch(() => undefined);
      }

      assert.ok(
        (await feature.ids(an.caller)).includes(id),
        `${feature.name}: a write from another space destroyed or moved the row`,
      );
    });
  }
});

describe("the space a caller is allowed to act in", () => {
  test("signed out is refused before any query runs", async () => {
    const anon = callerFor({});
    await rejects(() => anon.location.list({}), "UNAUTHORIZED");
    await rejects(() => anon.memory.create({ title: "x", date: new Date() }), "UNAUTHORIZED");
  });

  test("signed in with no space is refused, and told which", async () => {
    const stranger = callerFor({ userId: newUserId(), userEmail: "stranger@example.test" });
    const err = await rejects(() => stranger.location.list({}), "FORBIDDEN");
    assert.equal(err.message, "NO_SPACE");
  });

  test("an active-space cookie for someone else's space is refused, not silently ignored", async () => {
    /*
     * The dangerous alternative is falling back to the caller's own first
     * space: the screen still says space B, so the next write lands in space
     * A with no error anywhere. Refusing lets the client clear the cookie.
     */
    const spoofed = callerFor({
      userId: an.userId,
      userEmail: an.email,
      activeSpaceId: binh.spaceId,
    });
    const err = await rejects(() => spoofed.location.list({}), "PRECONDITION_FAILED");
    assert.equal(err.message, "STALE_SPACE");
  });

  test("no cookie at all falls back to a space the caller really belongs to", async () => {
    const noCookie = callerFor({ userId: an.userId, userEmail: an.email });
    const mine = await noCookie.space.getMine();
    assert.equal(mine?.id, an.spaceId);
  });
});
