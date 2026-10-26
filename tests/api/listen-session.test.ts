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

/*
 * Chủ repo báo 26/10: tua khi đang xem cùng thì không đồng bộ. Bản ghi vị trí
 * định kỳ (15 giây một lần) của máy kia ghi đè cú tua trước khi nó kịp tới, và
 * máy vừa tua bị kéo ngược về chỗ cũ. Lệnh nay có số thứ tự (epoch); bản ghi
 * định kỳ phải mang epoch của lệnh nó đã theo.
 */
describe("commands and refreshes", () => {
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

  test("accepting is the first command, and a seek is a command too", async () => {
    const accepted = await live();
    assert.equal(accepted.epoch, 1);
    const seeked = await couple.a.caller.listen.control({ positionSec: 120 });
    assert.equal(seeked?.epoch, 2, "a seek changes neither playing nor the track, but it is still a command");
  });

  test("a refresh from behind the latest command is refused, so the seek survives", async () => {
    await live(); // epoch 1, which Bình has followed
    await couple.a.caller.listen.control({ positionSec: 300 }); // An seeks: epoch 2
    // Bình's player has not heard about the seek yet and writes down where it is.
    const answer = await couple.b.caller.listen.control({
      positionSec: 20,
      isPlaying: true,
      index: 0,
      kind: "refresh",
      epoch: 1,
    });
    assert.equal(answer?.epoch, 2, "the refusal hands back the state Bình is behind");
    const now = await couple.a.caller.listen.current();
    assert.ok(now && Math.abs(now.positionSec - 300) < 1, `the seek was undone: ${now?.positionSec}`);
    assert.equal(now?.updatedBy, couple.a.userId);
  });

  test("a refresh from someone who has followed the latest command is written, and is not a command", async () => {
    await live();
    await couple.a.caller.listen.control({ positionSec: 300 }); // epoch 2
    const refreshed = await couple.b.caller.listen.control({
      positionSec: 305,
      isPlaying: true,
      index: 0,
      kind: "refresh",
      epoch: 2,
    });
    assert.equal(refreshed?.positionSec, 305);
    assert.equal(refreshed?.epoch, 2, "a refresh must not count as a command");
  });

  /*
   * Đo bằng hai trình duyệt (e2e `listen-sync`): bản ghi định kỳ mang `index`
   * của hàng đợi CỦA MÁY ĐÓ — không phải của phiên — và đã chuyển cả hai người
   * sang bài kế. Nó cũng mang `isPlaying: false` từ một máy chưa kịp báo trạng
   * thái, đủ để dừng cả hai. Bản ghi định kỳ nay chỉ được ghi VỊ TRÍ.
   */
  test("a refresh never moves the track and never pauses", async () => {
    await live(); // epoch 1, index 0, playing
    const r = await couple.b.caller.listen.control({
      positionSec: 40,
      isPlaying: true,
      index: 1,
      trackId: TRACK.id,
      kind: "refresh",
      epoch: 1,
    });
    assert.equal(r?.index, 0, "a refresh moved both people to another song");
    assert.equal(r?.positionSec, 40);
    assert.equal(r?.epoch, 1);
  });

  test("a refresh from a player on another track, or paused while the session plays, is refused", async () => {
    await live();
    await couple.a.caller.listen.control({ positionSec: 50 }); // epoch 2, An at 50 s
    const otherTrack = await couple.b.caller.listen.control({
      positionSec: 5, isPlaying: true, trackId: TRACK_2.id, kind: "refresh", epoch: 2,
    });
    assert.ok(otherTrack && Math.abs(otherTrack.positionSec - 50) < 1, "a player on another track wrote its position");
    const paused = await couple.b.caller.listen.control({
      positionSec: 5, isPlaying: false, trackId: TRACK.id, kind: "refresh", epoch: 2,
    });
    assert.equal(paused?.isPlaying, true, "a refresh paused the session for both");
    assert.ok(paused && Math.abs(paused.positionSec - 50) < 1, "a paused player wrote its frozen position");
  });

  test("an installed app still on old code (no kind, no epoch) keeps working", async () => {
    await live();
    const old = await couple.a.caller.listen.control({ isPlaying: false, positionSec: 10 });
    assert.equal(old?.isPlaying, false);
    assert.equal(old?.epoch, 2, "with no kind it is what every call used to be: a command");
  });
});

/*
 * Bấm lúc mất mạng: lệnh được giữ lại và gửi khi có mạng. Đo bằng hai trình
 * duyệt (e2e `listen-real`): cú "phát" bấm lúc mất mạng tới muộn và đè lên cú
 * "dừng" người kia bấm SAU đó, không ai được báo. Lệnh nay mang `baseEpoch` —
 * lệnh mới nhất máy đó đã thấy lúc bấm.
 */
describe("a command pressed offline and delivered late", () => {
  async function live() {
    await reset();
    const { session } = await couple.a.caller.listen.invite({
      queue: [TRACK, TRACK_2],
      index: 0,
      positionSec: 0,
      isPlaying: true,
    });
    return couple.b.caller.listen.respond({ sessionId: session.id, accept: true }); // epoch 1
  }

  test("is dropped when the OTHER person acted after it was pressed", async () => {
    await live();
    // Bình, offline, pauses having seen epoch 1. Meanwhile An seeks: epoch 2.
    await couple.a.caller.listen.control({ positionSec: 200 });
    const late = await couple.b.caller.listen.control({ isPlaying: false, positionSec: 30, baseEpoch: 1 });
    assert.equal(late?.stale, true, "Bình must be told the press was dropped");
    assert.equal(late?.isPlaying, true, "the stale pause stopped An");
    const now = await couple.a.caller.listen.current();
    assert.ok(now && Math.abs(now.positionSec - 200) < 2, `An's seek was undone: ${now?.positionSec}`);
    assert.equal(now?.epoch, 2);
  });

  test("still applies when nobody else has acted since — what the person meant stands", async () => {
    await live();
    const late = await couple.b.caller.listen.control({ isPlaying: false, positionSec: 30, baseEpoch: 1 });
    assert.equal(late?.stale, undefined);
    assert.equal(late?.isPlaying, false);
    assert.equal(late?.epoch, 2);
  });

  test("is not dropped behind the person's OWN earlier press", async () => {
    await live();
    // Two presses queued offline, both made having seen epoch 1.
    await couple.b.caller.listen.control({ isPlaying: false, positionSec: 30, baseEpoch: 1 });
    const second = await couple.b.caller.listen.control({ isPlaying: true, positionSec: 30, baseEpoch: 1 });
    assert.equal(second?.stale, undefined);
    assert.equal(second?.isPlaying, true);
    assert.equal(second?.epoch, 3);
  });

  /*
   * Đo bằng hai trình duyệt: Bình dừng đúng lúc An tua. Cả hai lệnh cùng đọc
   * thấy epoch 1 nên cả hai được ghi; máy Bình theo cú tua, máy An theo cú dừng
   * rồi phát tiếp từ đó — hai người phát lệch nhau 117 giây.
   */
  test("two presses made at the same moment: exactly one stands, the other is told", async () => {
    for (let round = 0; round < 5; round++) {
      await live();
      const [an, binh] = await Promise.all([
        couple.a.caller.listen.control({ positionSec: 160, isPlaying: true, baseEpoch: 1 }),
        couple.b.caller.listen.control({ isPlaying: false, positionSec: 44, baseEpoch: 1 }),
      ]);
      const stale = [an?.stale, binh?.stale].filter(Boolean).length;
      assert.equal(stale, 1, `round ${round}: ${stale} of the two were refused`);
      const now = await couple.a.caller.listen.current();
      assert.equal(now?.epoch, 2, `round ${round}: both were written`);
      const winner = an?.stale ? binh : an;
      assert.equal(now?.isPlaying, winner?.isPlaying);
    }
  });

  test("a refresh is untouched by it", async () => {
    await live();
    await couple.a.caller.listen.control({ positionSec: 200 }); // epoch 2
    const r = await couple.b.caller.listen.control({
      positionSec: 205, isPlaying: true, trackId: TRACK.id, kind: "refresh", epoch: 2, baseEpoch: 1,
    });
    assert.equal(r?.stale, undefined);
    assert.equal(r?.positionSec, 205);
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
