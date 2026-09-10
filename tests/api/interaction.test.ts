/*
 * Reactions and notes — the only way the partner who never uploads anything
 * can answer.
 *
 * Three rules are easy to get wrong and invisible when they are:
 *
 *   - one reaction per person per target. The toggle is written as
 *     delete-then-upsert precisely so two fast taps cannot interleave into
 *     two rows for one person.
 *   - a target id from another couple must be refused, not decorated. Nothing
 *     else stops a client attaching a note to somebody else's memory.
 *   - a note is deletable by its author only. Both people can read the
 *     thread, so "I can see it" must not mean "I can delete it".
 *
 * And a malformed id has to come back as a 400 from the schema rather than a
 * Mongoose CastError surfacing as a 500.
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, closeDatabase, makeCouple, makeMember, must, rejects } from "./_harness.ts";

let couple: Awaited<ReturnType<typeof makeCouple>>;
let outsider: Awaited<ReturnType<typeof makeMember>>;
let memoryId: string;
let theirMemoryId: string;

before(async () => {
  await freshDatabase();
  couple = await makeCouple({ a: "An", b: "Binh" });
  outsider = await makeMember({ name: "Chi", spaceName: "Góc khác" });
  memoryId = (await couple.a.caller.memory.create({ title: "Đi biển", date: new Date("2026-05-01") })).id;
  theirMemoryId = (await outsider.caller.memory.create({ title: "Của người khác", date: new Date("2026-05-02") })).id;
});

after(closeDatabase);

const mine = (targetIds: string[] = [memoryId]) =>
  couple.a.caller.interaction.forTargets({ targetType: "memory", targetIds });

describe("reacting", () => {
  test("a first tap adds the reaction", async () => {
    const res = await couple.a.caller.interaction.react({
      targetType: "memory",
      targetId: memoryId,
      emoji: "❤️",
    });
    assert.deepEqual(res.reactions, [{ userId: couple.a.userId, emoji: "❤️" }]);
  });

  test("the same emoji again takes it off", async () => {
    const res = await couple.a.caller.interaction.react({
      targetType: "memory",
      targetId: memoryId,
      emoji: "❤️",
    });
    assert.deepEqual(res.reactions, []);
  });

  test("a different emoji replaces it — one reaction per person", async () => {
    await couple.a.caller.interaction.react({ targetType: "memory", targetId: memoryId, emoji: "❤️" });
    const res = await couple.a.caller.interaction.react({
      targetType: "memory",
      targetId: memoryId,
      emoji: "😂",
    });
    assert.equal(res.reactions.length, 1, "one person must never hold two reactions");
    assert.deepEqual(res.reactions, [{ userId: couple.a.userId, emoji: "😂" }]);
  });

  test("the two of them react side by side", async () => {
    const res = await couple.b.caller.interaction.react({
      targetType: "memory",
      targetId: memoryId,
      emoji: "🔥",
    });
    assert.equal(res.reactions.length, 2);
    // Compared as a set: emoji sort by code point, which is not the order
    // anyone would write them in.
    assert.deepEqual(
      res.reactions.map((r) => r.emoji).sort(),
      ["😂", "🔥"].sort(),
    );
    assert.deepEqual(
      res.reactions.map((r) => r.userId).sort(),
      [couple.a.userId, couple.b.userId].sort(),
    );
  });

  test("an emoji outside the list never reaches the database", async () => {
    await rejects(
      () =>
        couple.a.caller.interaction.react({
          targetType: "memory",
          targetId: memoryId,
          emoji: "🍕" as "❤️",
        }),
      "BAD_REQUEST",
    );
  });

  test("a malformed id is a 400, not a cast error", async () => {
    await rejects(
      () => couple.a.caller.interaction.react({ targetType: "memory", targetId: "khong-phai-id", emoji: "❤️" }),
      "BAD_REQUEST",
    );
    await rejects(() => mine(["123"]), "BAD_REQUEST");
  });

  test("another couple's memory cannot be reacted to", async () => {
    const err = await rejects(
      () =>
        couple.a.caller.interaction.react({
          targetType: "memory",
          targetId: theirMemoryId,
          emoji: "❤️",
        }),
      "NOT_FOUND",
    );
    assert.equal(err.message, "BAD_TARGET");
  });
});

describe("notes", () => {
  test("a note is added and read back in the order written", async () => {
    const first = await couple.a.caller.interaction.addNote({
      targetType: "memory",
      targetId: memoryId,
      body: "Hôm đó nắng lắm",
    });
    const second = await couple.b.caller.interaction.addNote({
      targetType: "memory",
      targetId: memoryId,
      body: "Ừ, cháy nắng luôn",
    });

    const seen = must((await mine())[memoryId], "target row");
    assert.deepEqual(
      seen.notes.map((n) => n.id),
      [first.note.id, second.note.id],
      "notes read back oldest first",
    );
    assert.equal(seen.notes[1].userId, couple.b.userId);
  });

  test("only the author may delete one", async () => {
    const { note } = await couple.a.caller.interaction.addNote({
      targetType: "memory",
      targetId: memoryId,
      body: "Của An",
    });
    const err = await rejects(
      () => couple.b.caller.interaction.removeNote({ id: note.id }),
      "FORBIDDEN",
    );
    assert.equal(err.message, "NOT_AUTHOR");
    assert.ok(must((await mine())[memoryId], "row").notes.some((n) => n.id === note.id));

    await couple.a.caller.interaction.removeNote({ id: note.id });
    assert.ok(!must((await mine())[memoryId], "row").notes.some((n) => n.id === note.id));
  });

  test("another couple's note cannot be reached at all", async () => {
    const theirs = await outsider.caller.interaction.addNote({
      targetType: "memory",
      targetId: theirMemoryId,
      body: "Ghi chú của người khác",
    });
    await rejects(() => couple.a.caller.interaction.removeNote({ id: theirs.note.id }), "NOT_FOUND");
    await rejects(
      () =>
        couple.a.caller.interaction.addNote({
          targetType: "memory",
          targetId: theirMemoryId,
          body: "Xen vào",
        }),
      "NOT_FOUND",
    );
  });

  test("an empty note is refused and a long one is bounded", async () => {
    await rejects(
      () => couple.a.caller.interaction.addNote({ targetType: "memory", targetId: memoryId, body: "   " }),
      "BAD_REQUEST",
    );
    await rejects(
      () =>
        couple.a.caller.interaction.addNote({
          targetType: "memory",
          targetId: memoryId,
          body: "x".repeat(501),
        }),
      "BAD_REQUEST",
    );
  });
});

describe("reading a batch", () => {
  test("an id from another space is simply absent, not an empty shell", async () => {
    const seen = await mine([memoryId, theirMemoryId]);
    assert.ok(seen[memoryId], "our own memory is there");
    assert.equal(
      seen[theirMemoryId],
      undefined,
      "another couple's id must not come back at all, not even empty",
    );
  });

  test("no ids means no work", async () => {
    assert.deepEqual(await mine([]), {});
  });

  test("the batch is bounded so the $in cannot grow without limit", async () => {
    const many = Array.from({ length: 51 }, () => memoryId.slice(0, 23) + "0");
    await rejects(() => mine(many), "BAD_REQUEST");
  });

  test("a repeated id is asked for once", async () => {
    const seen = await mine([memoryId, memoryId, memoryId]);
    assert.deepEqual(Object.keys(seen), [memoryId]);
  });
});
