/*
 * Points and vouchers — the only place in the app that keeps a number the
 * couple would argue about.
 *
 * Two things here cannot be checked by looking at a screen. `forUserId` comes
 * from the CLIENT on both crediting and charging, so the only thing stopping
 * one couple crediting a stranger is a membership guard on the way in. And
 * redeeming is two writes: claim the voucher, then charge the balance — if the
 * charge fails the claim has to be rolled back, or a voucher nobody could
 * afford is burnt for ever.
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, closeDatabase, makeCouple, makeMember, must, rejects } from "./_harness.ts";

let couple: Awaited<ReturnType<typeof makeCouple>>;
let outsider: Awaited<ReturnType<typeof makeMember>>;

before(async () => {
  await freshDatabase();
  couple = await makeCouple({ a: "An", b: "Binh" });
  outsider = await makeMember({ name: "Chi", spaceName: "Góc khác" });
});

after(closeDatabase);

const balanceOf = async (userId: string) => {
  const o = await couple.a.caller.reward.overview();
  return must(o.balances.find((b) => b.userId === userId), "balance row").balance;
};

describe("crediting a task", () => {
  test("both members appear in the overview, and each knows which row is theirs", async () => {
    const seen = await couple.a.caller.reward.overview();
    assert.equal(seen.balances.length, 2);
    assert.deepEqual(
      seen.balances.map((b) => b.isMe),
      seen.balances.map((b) => b.userId === couple.a.userId),
    );
    assert.ok(seen.balances.every((b) => b.balance === 0), "nobody starts with points");
  });

  test("points land on the member named, and the log records it", async () => {
    const { id: taskId } = await couple.a.caller.reward.createTask({ title: "Rửa bát", points: 30 });
    await couple.a.caller.reward.completeTask({ taskId, forUserId: couple.b.userId });

    assert.equal(await balanceOf(couple.b.userId), 30);
    assert.equal(await balanceOf(couple.a.userId), 0, "crediting one person must not credit the other");

    const log = must((await couple.a.caller.reward.overview()).recentLogs[0], "log row");
    assert.equal(log.userId, couple.b.userId);
    assert.equal(log.points, 30);
    assert.equal(log.taskTitle, "Rửa bát");
  });

  test("a task can be completed again — the points add up", async () => {
    const { id: taskId } = await couple.a.caller.reward.createTask({ title: "Đổ rác", points: 5 });
    await couple.a.caller.reward.completeTask({ taskId, forUserId: couple.a.userId });
    await couple.a.caller.reward.completeTask({ taskId, forUserId: couple.a.userId });
    assert.equal(await balanceOf(couple.a.userId), 10);
  });

  test("a stranger cannot be credited, even though the client names them", async () => {
    const { id: taskId } = await couple.a.caller.reward.createTask({ title: "Nấu cơm", points: 20 });
    const err = await rejects(
      () => couple.a.caller.reward.completeTask({ taskId, forUserId: outsider.userId }),
      "BAD_REQUEST",
    );
    assert.equal(err.message, "NOT_A_MEMBER");
  });

  test("another couple's task cannot be completed here", async () => {
    const theirs = await outsider.caller.reward.createTask({ title: "Việc của người khác", points: 999 });
    await rejects(
      () => couple.a.caller.reward.completeTask({ taskId: theirs.id, forUserId: couple.a.userId }),
      "NOT_FOUND",
    );
    assert.equal(await balanceOf(couple.a.userId), 10, "the balance must not have moved");
  });

  test("a task belongs to the space that made it", async () => {
    const mine = (await couple.a.caller.reward.overview()).tasks.map((t) => t.title);
    const theirs = (await outsider.caller.reward.overview()).tasks.map((t) => t.title);
    assert.ok(mine.includes("Rửa bát"));
    assert.ok(!theirs.includes("Rửa bát"), "a task leaked into another space");
    assert.ok(!mine.includes("Việc của người khác"));
  });
});

describe("redeeming a voucher", () => {
  test("enough points: the voucher is spent and the balance drops by its cost", async () => {
    const { id: taskId } = await couple.a.caller.reward.createTask({ title: "Việc lớn", points: 100 });
    await couple.a.caller.reward.completeTask({ taskId, forUserId: couple.b.userId });
    const before_ = await balanceOf(couple.b.userId);

    const { id: voucherId } = await couple.a.caller.reward.createVoucher({ title: "Một buổi cà phê", cost: 40 });
    await couple.a.caller.reward.redeem({ voucherId, forUserId: couple.b.userId });

    assert.equal(await balanceOf(couple.b.userId), before_ - 40);
    const v = must(
      (await couple.a.caller.reward.overview()).vouchers.find((x) => x.id === voucherId),
      "voucher",
    );
    assert.equal(v.redeemed, true);
    assert.equal(v.redeemedBy, couple.b.userId);
  });

  test("a voucher is single-use", async () => {
    const { id: taskId } = await couple.a.caller.reward.createTask({ title: "Việc nữa", points: 100 });
    await couple.a.caller.reward.completeTask({ taskId, forUserId: couple.b.userId });
    const { id: voucherId } = await couple.a.caller.reward.createVoucher({ title: "Một bữa ăn", cost: 10 });

    await couple.a.caller.reward.redeem({ voucherId, forUserId: couple.b.userId });
    const err = await rejects(
      () => couple.a.caller.reward.redeem({ voucherId, forUserId: couple.b.userId }),
      "BAD_REQUEST",
    );
    assert.equal(err.message, "ALREADY_REDEEMED");
  });

  test("not enough points: nothing is charged AND the voucher stays available", async () => {
    /*
     * The claim happens before the charge, so a refused redeem has to undo
     * its own claim. Without the rollback the voucher is marked spent by
     * somebody who never paid for it and can never be redeemed again — the
     * points are still there and the reward is simply gone.
     */
    const { id: voucherId } = await couple.a.caller.reward.createVoucher({
      title: "Chuyến đi xa",
      cost: 100000,
    });
    const before_ = await balanceOf(couple.a.userId);

    const err = await rejects(
      () => couple.a.caller.reward.redeem({ voucherId, forUserId: couple.a.userId }),
      "CONFLICT",
    );
    assert.equal(err.message, "INSUFFICIENT_POINTS");
    assert.equal(await balanceOf(couple.a.userId), before_, "a refused redeem must not charge anything");

    const v = must(
      (await couple.a.caller.reward.overview()).vouchers.find((x) => x.id === voucherId),
      "voucher",
    );
    assert.equal(v.redeemed, false, "the claim was not rolled back — the voucher is burnt");
    assert.equal(v.redeemedBy, null);
  });

  test("a stranger cannot be charged, and another couple's voucher cannot be spent", async () => {
    const { id: voucherId } = await couple.a.caller.reward.createVoucher({ title: "Quà nhỏ", cost: 1 });
    const err = await rejects(
      () => couple.a.caller.reward.redeem({ voucherId, forUserId: outsider.userId }),
      "BAD_REQUEST",
    );
    assert.equal(err.message, "NOT_A_MEMBER");

    await rejects(
      () => outsider.caller.reward.redeem({ voucherId, forUserId: outsider.userId }),
      "BAD_REQUEST",
    );
    const v = must(
      (await couple.a.caller.reward.overview()).vouchers.find((x) => x.id === voucherId),
      "voucher",
    );
    assert.equal(v.redeemed, false, "an outsider's refused attempt must leave it available");
  });
});

describe("what the input will accept", () => {
  test("points and costs must be whole and positive", async () => {
    await rejects(() => couple.a.caller.reward.createTask({ title: "Sai", points: 0 }), "BAD_REQUEST");
    await rejects(() => couple.a.caller.reward.createTask({ title: "Sai", points: -5 }), "BAD_REQUEST");
    await rejects(() => couple.a.caller.reward.createTask({ title: "Sai", points: 1.5 }), "BAD_REQUEST");
    await rejects(() => couple.a.caller.reward.createVoucher({ title: "Sai", cost: 0 }), "BAD_REQUEST");
    await rejects(() => couple.a.caller.reward.createTask({ title: "   ", points: 10 }), "BAD_REQUEST");
  });
});
