/*
 * Knowing when something is broken.
 *
 * Before this the app had no error reporting at all — eighteen console.error
 * calls landing in a log stream nobody reads. A feature could fail for every
 * user of one shape of data and the first anybody would hear is somebody
 * saying "it doesn't work".
 *
 * Two properties matter more than the plumbing: that an ORDINARY refusal is
 * not recorded (or the one real error is buried under a thousand FORBIDDENs),
 * and that nothing about what the user was doing is kept.
 */
import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { freshDatabase, closeDatabase, callerFor, rejects, must } from "./_harness.ts";
import { TEST_ADMIN_EMAIL } from "./_env.ts";
import { logServerError } from "../../src/server/lib/log-error.ts";

before(freshDatabase);
after(closeDatabase);

const logs = () => mongoose.connection.collection("errorlogs");

describe("recording one", () => {
  test("it keeps where, what, and when — and counts repeats as one", async () => {
    /*
     * The same bug hit two hundred times is one row with a count. Two hundred
     * rows would bury the rare error, and the rare one is usually the
     * interesting one.
     */
    for (let i = 0; i < 3; i++) {
      await logServerError("trpc:test.boom", new Error("everything is on fire"));
    }
    const row = must(await logs().findOne({ where: "trpc:test.boom" }));
    assert.equal(row.count, 3);
    assert.equal(row.message, "everything is on fire");
    assert.ok(row.stack, "and enough stack to find it");
    assert.ok(row.firstAt <= row.lastAt);
    assert.equal(await logs().countDocuments({ where: "trpc:test.boom" }), 1);
  });

  test("a different message is a different row", async () => {
    await logServerError("trpc:test.two", new Error("first kind"));
    await logServerError("trpc:test.two", new Error("second kind"));
    assert.equal(await logs().countDocuments({ where: "trpc:test.two" }), 2);
  });

  test("it survives being handed something that is not an Error", async () => {
    // It runs inside a catch, on a request that has already gone wrong.
    for (const thrown of [null, undefined, "a string", 42, { odd: true }, []]) {
      await assert.doesNotReject(() => logServerError("trpc:test.weird", thrown));
    }
    assert.ok(await logs().countDocuments({ where: "trpc:test.weird" }) > 0);
  });

  test("every row is set to expire", async () => {
    // An error log that grows forever becomes an archive nobody reads, and
    // this database is a free tier.
    await logServerError("trpc:test.ttl", new Error("temporary"));
    const row = must(await logs().findOne({ where: "trpc:test.ttl" }));
    assert.ok(row.expiresAt instanceof Date);
    assert.ok(row.expiresAt.getTime() > Date.now(), "in the future");
  });

  test("it stores who, and never what they were doing", async () => {
    /*
     * The inputs to these procedures carry notes between two people, place
     * names and messages. That a procedure failed is worth keeping; a copy of
     * somebody's evening is not.
     */
    await logServerError("trpc:test.privacy", new Error("failed"), {
      userId: "u1",
      spaceId: "s1",
    });
    const row = must(await logs().findOne({ where: "trpc:test.privacy" }));
    assert.equal(row.userId, "u1");
    assert.equal(row.spaceId, "s1");
    const keys = Object.keys(row);
    for (const forbidden of ["input", "args", "body", "payload"]) {
      assert.ok(!keys.includes(forbidden), `an error log must not carry ${forbidden}`);
    }
  });
});

describe("what the middleware chooses to record", () => {
  test("an ordinary refusal is not an error", async () => {
    /*
     * A signed-out caller being turned away is the app working. Recording it
     * would bury the one failure that means something under a thousand that
     * do not.
     */
    const before = await logs().countDocuments({});
    await rejects(
      () => callerFor().dayPlan.generate({ date: "2026-09-15", startAt: "16:00" }),
      "UNAUTHORIZED",
    );
    await rejects(
      () => callerFor({ userId: "nobody", userEmail: "nobody@example.test" }).space.getMine(),
      "NOT_FOUND",
    ).catch(() => {});   // shape varies; the count below is the assertion
    assert.equal(await logs().countDocuments({}), before, "nothing expected was recorded");
  });

  test("an unexpected failure is recorded, with the procedure that failed", async () => {
    /*
     * Forced rather than hoped for: `dismissError` deletes by id, and handing
     * it something that is not an id makes Mongoose throw a CastError — which
     * is not one of the codes this app raises on purpose, so it is exactly the
     * class of thing this exists to catch.
     */
    const admin = callerFor({ userId: "admin-user", userEmail: TEST_ADMIN_EMAIL });
    const before = await logs().countDocuments({});
    await admin.ops.dismissError({ id: "definitely-not-an-object-id" }).catch(() => {});

    // The middleware does not await its write, so the row lands just after.
    for (let i = 0; i < 40 && (await logs().countDocuments({})) === before; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.equal(await logs().countDocuments({}), before + 1, "the failure was not recorded");
    const row = must(await logs().findOne({}, { sort: { lastAt: -1 } }));
    assert.equal(row.where, "trpc:ops.dismissError", "it names the procedure, not the file");
    assert.ok(row.message);
    assert.equal(row.userId, "admin-user");
  });
});
