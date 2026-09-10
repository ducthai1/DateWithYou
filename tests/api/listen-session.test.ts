/*
 * Listening together: the part two devices have to agree on.
 *
 * Every rule here was a bug on somebody's phone first. A session reusing its
 * id meant the second decline was never seen and the other side waited for
 * ever. A position stamped "true now" on accept yanked the host backwards by
 * however long the answer took. A skip that reset the playhead on a re-sent
 * same index restarted the song under whoever was listening. None of those
 * are visible with one browser open, which is exactly why they belong here.
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, closeDatabase, makeCouple, makeMember, rejects } from "./_harness.ts";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TRACK = {
  id: "yt-1",
  kind: "music",
  title: "Bài một",
  thumbnailUrl: null,
  providerLabel: "YouTube",
  provider: "youtube",
  embedUrl: "https://www.youtube.com/embed/aaa",
};
const TRACK_2 = { ...TRACK, id: "yt-2", title: "Bài hai", embedUrl: "https://www.youtube.com/embed/bbb" };

let couple: Awaited<ReturnType<typeof makeCouple>>;

before(async () => {
  await freshDatabase();
  couple = await makeCouple({ a: "An", b: "Binh" });
});

after(closeDatabase);

/** Clear any session left by the previous test so each starts from nothing. */
async function reset() {
  await couple.a.caller.listen.end();
  await couple.b.caller.listen.end();
}

describe("inviting", () => {
  test("a space with one person cannot invite anybody", async () => {
    const alone = await makeMember({ name: "Solo" });
    await rejects(
      () => alone.caller.listen.invite({ queue: [TRACK], index: 0 }),
      "BAD_REQUEST",
    );
  });

  test("the invite names the partner as guest and starts unanswered", async () => {
    await reset();
    const { session } = await couple.a.caller.listen.invite({ queue: [TRACK], index: 0 });
    assert.equal(session.status, "inviting");
    assert.equal(session.hostId, couple.a.userId);
    assert.equal(session.guestId, couple.b.userId);
    assert.equal(session.index, 0);
  });

  test("each invite is a NEW session, so the other side always hears about it", async () => {
    /*
     * The id is how a client tells one session from the next. When invite
     * upserted on {spaceId} the document kept its id for ever, and the second
     * decline in a space looked identical to the first — the waiting screen
     * never moved.
     */
    await reset();
    const first = (await couple.a.caller.listen.invite({ queue: [TRACK], index: 0 })).session;
    const second = (await couple.a.caller.listen.invite({ queue: [TRACK_2], index: 0 })).session;
    assert.notEqual(first.id, second.id);

    // And only one lives at a time.
    const current = await couple.b.caller.listen.current();
    assert.equal(current?.id, second.id);
  });

  test("an index past the end of the queue is clamped, not stored as-is", async () => {
    await reset();
    const { session } = await couple.a.caller.listen.invite({ queue: [TRACK, TRACK_2], index: 9 });
    assert.equal(session.index, 1);
  });
});

describe("answering", () => {
  test("only the invited person may answer", async () => {
    await reset();
    const { session } = await couple.a.caller.listen.invite({ queue: [TRACK], index: 0 });
    // The host answering their own invite would start a session nobody agreed to.
    await rejects(() => couple.a.caller.listen.respond({ sessionId: session.id, accept: true }), "NOT_FOUND");
    assert.equal((await couple.b.caller.listen.current())?.status, "inviting");
  });

  test("declining ends it, and it cannot be answered twice", async () => {
    await reset();
    const { session } = await couple.a.caller.listen.invite({ queue: [TRACK], index: 0 });
    const declined = await couple.b.caller.listen.respond({ sessionId: session.id, accept: false });
    assert.equal(declined.status, "ended");
    await rejects(() => couple.b.caller.listen.respond({ sessionId: session.id, accept: true }), "NOT_FOUND");
    assert.equal(await couple.a.caller.listen.current(), null);
  });

  test("accepting a playing invite moves the playhead on by the time it took to answer", async () => {
    await reset();
    const { session } = await couple.a.caller.listen.invite({
      queue: [TRACK],
      index: 0,
      positionSec: 30,
      isPlaying: true,
    });
    assert.equal(session.positionSec, 30);

    await wait(1500);
    const live = await couple.b.caller.listen.respond({ sessionId: session.id, accept: true });

    assert.equal(live.status, "live");
    assert.ok(live.isPlaying);
    assert.ok(
      live.positionSec >= 31.2,
      `the song kept playing while the invite waited, so the playhead must have moved past 30s (got ${live.positionSec})`,
    );
    assert.ok(live.positionSec < 40, `but only by the waiting time (got ${live.positionSec})`);
  });

  test("accepting a paused invite starts both of them from the same held position", async () => {
    await reset();
    const { session } = await couple.a.caller.listen.invite({
      queue: [TRACK],
      index: 0,
      positionSec: 12,
      isPlaying: false,
    });
    await wait(1200);
    const live = await couple.b.caller.listen.respond({ sessionId: session.id, accept: true });
    assert.equal(live.positionSec, 12, "nothing was playing, so nothing moved");
    assert.ok(live.isPlaying, "the answer is what starts the music");
  });
});

describe("driving a live session", () => {
  async function live() {
    await reset();
    const { session } = await couple.a.caller.listen.invite({
      queue: [TRACK, TRACK_2],
      index: 0,
      positionSec: 0,
      isPlaying: true,
    });
    return couple.b.caller.listen.respond({ sessionId: session.id, accept: true });
  }

  test("either person may drive it, and the change is recorded against them", async () => {
    await live();
    const paused = await couple.b.caller.listen.control({ isPlaying: false, positionSec: 45 });
    assert.equal(paused?.isPlaying, false);
    assert.equal(paused?.positionSec, 45);
    assert.equal(paused?.updatedBy, couple.b.userId);

    const resumed = await couple.a.caller.listen.control({ isPlaying: true });
    assert.equal(resumed?.isPlaying, true);
    assert.equal(resumed?.positionSec, 45, "resuming is not a seek");
    assert.equal(resumed?.updatedBy, couple.a.userId);
  });

  test("moving to a different track starts it from the beginning", async () => {
    await live();
    await couple.a.caller.listen.control({ positionSec: 90 });
    const next = await couple.a.caller.listen.control({ index: 1 });
    assert.equal(next?.index, 1);
    assert.equal(next?.positionSec, 0);
  });

  test("re-sending the same index is not a skip and must not restart the song", async () => {
    /*
     * The client writes its full state periodically, index included. Treating
     * that as a skip rewound the track under whoever was listening.
     */
    await live();
    await couple.a.caller.listen.control({ positionSec: 75 });
    const same = await couple.a.caller.listen.control({ index: 0 });
    assert.equal(same?.index, 0);
    assert.equal(same?.positionSec, 75);
  });

  test("an index past the end of the queue is clamped here too", async () => {
    await live();
    const clamped = await couple.a.caller.listen.control({ index: 12 });
    assert.equal(clamped?.index, 1);
  });

  test("controlling nothing answers null instead of inventing a session", async () => {
    await reset();
    assert.equal(await couple.a.caller.listen.control({ isPlaying: true }), null);
  });

  test("an unanswered invite is not drivable — it is not live yet", async () => {
    await reset();
    await couple.a.caller.listen.invite({ queue: [TRACK], index: 0 });
    assert.equal(await couple.a.caller.listen.control({ positionSec: 10 }), null);
  });

  test("the position is handed over as an age, not a timestamp", async () => {
    /*
     * Two phones disagree about what time it is. A follower that added its own
     * clock to a server timestamp would seek somewhere else entirely.
     */
    await live();
    await couple.a.caller.listen.control({ positionSec: 20 });
    await wait(900);
    const seen = await couple.b.caller.listen.current();
    assert.ok(seen && seen.stateAgeMs >= 800, `an age must grow with time (got ${seen?.stateAgeMs})`);
    assert.ok(seen.stateAgeMs < 60_000, "and must be an age, not epoch milliseconds");
  });

  test("either person ending it ends it for both", async () => {
    await live();
    await couple.b.caller.listen.end();
    assert.equal(await couple.a.caller.listen.current(), null);
    assert.equal(await couple.b.caller.listen.current(), null);
  });
});

describe("another couple's session", () => {
  test("is invisible, and cannot be driven", async () => {
    await reset();
    await couple.a.caller.listen.invite({ queue: [TRACK], index: 0 });
    const outsider = await makeCouple({ a: "Chi", b: "Dung", spaceName: "Góc khác" });
    assert.equal(await outsider.a.caller.listen.current(), null);
    assert.equal(await outsider.a.caller.listen.control({ isPlaying: false }), null);
    assert.equal((await couple.b.caller.listen.current())?.status, "inviting");
    await reset();
  });
});
