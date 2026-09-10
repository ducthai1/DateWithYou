/*
 * The roadmap in Bí mật: things the couple wants to do one day.
 *
 * Small router, but it is the one place a list is ordered newest-first and
 * carries a status the UI moves between three columns — so what matters is
 * that a new row starts as an idea, that the status only ever takes one of
 * the three values, and that a patch of one field leaves the rest alone.
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

const rowOf = async (id: string) =>
  must((await couple.a.caller.plan.list()).find((p) => p.id === id), "plan row");

describe("a plan's life", () => {
  test("a new one is an idea until somebody moves it", async () => {
    const { id } = await couple.a.caller.plan.create({ title: "Đi Nhật" });
    const row = await rowOf(id);
    assert.equal(row.status, "idea");
    assert.equal(row.description, null);
    assert.equal(row.category, null);
    assert.equal(row.targetDate, null);
  });

  test("it moves through the three columns and nowhere else", async () => {
    const { id } = await couple.a.caller.plan.create({ title: "Mua nhà" });
    await couple.a.caller.plan.setStatus({ id, status: "planning" });
    assert.equal((await rowOf(id)).status, "planning");
    await couple.a.caller.plan.setStatus({ id, status: "done" });
    assert.equal((await rowOf(id)).status, "done");
    await rejects(
      () => couple.a.caller.plan.setStatus({ id, status: "xong rồi" as "done" }),
      "BAD_REQUEST",
    );
    assert.equal((await rowOf(id)).status, "done");
  });

  test("editing the title leaves the rest of the card alone", async () => {
    const { id } = await couple.a.caller.plan.create({
      title: "Học nhảy",
      description: "hai buổi một tuần",
      category: "cùng nhau",
      targetDate: new Date("2027-01-01"),
    });
    await couple.a.caller.plan.setStatus({ id, status: "planning" });
    await couple.a.caller.plan.update({ id, title: "Học nhảy đôi" });

    const row = await rowOf(id);
    assert.equal(row.title, "Học nhảy đôi");
    assert.equal(row.description, "hai buổi một tuần");
    assert.equal(row.category, "cùng nhau");
    assert.ok(row.targetDate, "the target date must survive a title edit");
    assert.equal(row.status, "planning", "a title edit must not move the card");
  });

  test("newest first", async () => {
    const titles = (await couple.a.caller.plan.list()).map((p) => p.title);
    assert.deepEqual(titles.slice(0, 3), ["Học nhảy đôi", "Mua nhà", "Đi Nhật"]);
  });

  test("removing takes it off the list", async () => {
    const { id } = await couple.a.caller.plan.create({ title: "Bỏ đi" });
    await couple.a.caller.plan.remove({ id });
    assert.ok(!(await couple.a.caller.plan.list()).some((p) => p.id === id));
  });

  test("a title is required and bounded", async () => {
    await rejects(() => couple.a.caller.plan.create({ title: "  " }), "BAD_REQUEST");
    await rejects(() => couple.a.caller.plan.create({ title: "x".repeat(121) }), "BAD_REQUEST");
  });
});

describe("another couple's roadmap", () => {
  test("is invisible, and untouchable", async () => {
    const mine = await couple.a.caller.plan.create({ title: "Của tụi mình" });
    assert.ok(!(await outsider.caller.plan.list()).some((p) => p.id === mine.id));

    await rejects(() => outsider.caller.plan.update({ id: mine.id, title: "Bị sửa" }), "NOT_FOUND");
    await rejects(
      () => outsider.caller.plan.setStatus({ id: mine.id, status: "done" }),
      "NOT_FOUND",
    );
    // remove answers ok either way; what must hold is that the row survives.
    await outsider.caller.plan.remove({ id: mine.id });

    const row = await rowOf(mine.id);
    assert.equal(row.title, "Của tụi mình");
    assert.equal(row.status, "idea");
  });
});
