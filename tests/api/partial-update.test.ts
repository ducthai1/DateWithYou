/*
 * A patch changes what it names, and nothing else.
 *
 * Every update procedure here spreads its parsed input into `$set`, so what
 * the schema decides an absent key means IS what gets written. zod keeps a
 * `.default()` through `.partial()`, which turned every omitted key into its
 * default and made a two-field patch overwrite the rest of the document.
 *
 * It was real, not hypothetical: removing one photo from a memory sends only
 * `{ id, photos }`, and the memory came back with no tags, no embeds and no
 * mentions. Renaming a blog post sent no `status`, so the post unpublished
 * itself and lost its body. Both are checked below with the exact payloads
 * the app sends.
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, closeDatabase, callerFor, makeCouple, makeUser, must, rejects } from "./_harness.ts";
import { TEST_ADMIN_EMAIL } from "./_env.ts";

let couple: Awaited<ReturnType<typeof makeCouple>>;
let admin: ReturnType<typeof callerFor>;

before(async () => {
  await freshDatabase();
  couple = await makeCouple({ a: "An", b: "Binh" });
  const a = await makeUser({ name: "Quan tri", email: TEST_ADMIN_EMAIL });
  admin = callerFor({ userId: a.id, userEmail: a.email });
});

after(closeDatabase);

describe("memory", () => {
  const photo = (id: string) => ({
    url: `https://res.cloudinary.com/demo/${id}.jpg`,
    publicId: id,
    width: 1200,
    height: 900,
  });

  async function full() {
    const { id } = await couple.a.caller.memory.create({
      title: "Chuyến đi Đà Lạt",
      caption: "vui lắm",
      date: new Date("2026-02-01"),
      photos: [photo("a"), photo("b")],
      tags: ["da-lat", "mua-dong"],
      embeds: [{ url: "https://www.youtube.com/watch?v=aaa" }],
      mentions: [couple.b.userId],
    });
    return id;
  }

  test("deleting one photo keeps the tags, embeds and mentions", async () => {
    // The exact payload the calendar's day view sends for the ✕ on a photo.
    const id = await full();
    await couple.a.caller.memory.update({ id, photos: [photo("a")] });

    const after = await couple.a.caller.memory.get({ id });
    assert.equal(after.photos.length, 1, "the photo was removed");
    assert.deepEqual(after.tags, ["da-lat", "mua-dong"], "tags must survive a photo patch");
    assert.equal(after.embeds.length, 1, "embeds must survive a photo patch");
    assert.deepEqual(after.mentions, [couple.b.userId], "mentions must survive a photo patch");
    assert.equal(after.caption, "vui lắm");
    assert.equal(after.title, "Chuyến đi Đà Lạt");
  });

  test("renaming keeps the photos", async () => {
    const id = await full();
    await couple.a.caller.memory.update({ id, title: "Đà Lạt 2026" });
    const after = await couple.a.caller.memory.get({ id });
    assert.equal(after.title, "Đà Lạt 2026");
    assert.equal(after.photos.length, 2, "a rename must not empty the album");
  });

  test("a patch that really does send an empty list still clears it", async () => {
    // The fix must not turn "clear the tags" into an unsendable request.
    const id = await full();
    await couple.a.caller.memory.update({ id, tags: [] });
    assert.deepEqual((await couple.a.caller.memory.get({ id })).tags, []);
  });
});

describe("blog", () => {
  async function full() {
    return admin.blog.create({
      title: "Bài đầy đủ",
      excerpt: "Mô tả ngắn",
      body: "# Nội dung\n\nrất nhiều chữ",
      category: "meo-hay",
      tags: ["hen-ho", "sai-gon"],
      featured: true,
      status: "published",
    });
  }

  test("renaming a published post leaves it published, with its body intact", async () => {
    const post = await full();
    const after = await admin.blog.update({ id: post.id, title: "Bài đầy đủ (sửa tiêu đề)" });

    assert.equal(after.title, "Bài đầy đủ (sửa tiêu đề)");
    assert.equal(after.status, "published", "a title edit must not unpublish the post");
    assert.ok(after.body.includes("rất nhiều chữ"), "the body must not be blanked");
    assert.equal(after.excerpt, "Mô tả ngắn");
    assert.equal(after.category, "meo-hay");
    assert.deepEqual(after.tags, ["hen-ho", "sai-gon"]);
    assert.equal(after.featured, true);
  });

  test("rescheduling by date alone leaves it published", async () => {
    const post = await full();
    const past = new Date(Date.now() - 1000);
    await admin.blog.update({ id: post.id, publishedAt: past });
    // Still reachable by the public page, which only ever sees live posts.
    assert.equal((await callerFor({}).blog.bySlug({ slug: post.slug })).slug, post.slug);
  });

  test("unpublishing still works when it is what was asked for", async () => {
    const post = await full();
    await admin.blog.update({ id: post.id, status: "draft" });
    await rejects(() => callerFor({}).blog.bySlug({ slug: post.slug }), "NOT_FOUND");
  });
});

describe("the other update procedures", () => {
  test("media keeps its tags through a title patch", async () => {
    const { id } = await couple.a.caller.media.create({
      kind: "music",
      title: "Bài hát",
      tags: ["chill", "acoustic"],
    });
    await couple.a.caller.media.update({ id, title: "Bài hát (sửa)" });
    const row = must((await couple.a.caller.media.list()).find((d: { id: string }) => d.id === id));
    assert.equal(row.title, "Bài hát (sửa)");
    assert.deepEqual(row.tags, ["chill", "acoustic"]);
  });

  test("a plan card keeps its tags and its cost", async () => {
    const { id } = await couple.a.caller.planItem.create({
      title: "Ăn tối",
      date: "2026-06-06",
      bucket: "evening",
      tags: ["hen-ho"],
      cost: 250000,
    });
    await couple.a.caller.planItem.update({ id, title: "Ăn tối (sửa)" });
    const row = must(
      (await couple.a.caller.planItem.listByRange({ fromKey: "2026-06-06", toKey: "2026-06-07" })).find(
        (d: { id: string }) => d.id === id,
      ),
    );
    assert.equal(row.title, "Ăn tối (sửa)");
    assert.deepEqual(row.tags, ["hen-ho"]);
    assert.equal(row.cost, 250000);
  });

  test("a wish keeps who it is for and what it costs in points", async () => {
    const { id } = await couple.a.caller.wishlist.create({
      itemName: "Tai nghe",
      forWhom: "me",
      pointCost: 120,
    });
    await couple.a.caller.wishlist.update({ id, itemName: "Tai nghe không dây" });
    const row = must((await couple.a.caller.wishlist.list()).find((d: { id: string }) => d.id === id));
    assert.equal(row.itemName, "Tai nghe không dây");
    assert.equal(row.forWhom, "me", "a rename must not hand the wish to the other person");
    assert.equal(row.pointCost, 120);
  });

  test("a trip keeps its budget through a title patch", async () => {
    const { id } = await couple.a.caller.trip.create({
      title: "Đà Nẵng",
      startDate: "2026-08-01",
      endDate: "2026-08-04",
      budget: 5_000_000,
    });
    await couple.a.caller.trip.update({ id, title: "Đà Nẵng 4 ngày" });
    const trip = await couple.a.caller.trip.get({ id });
    assert.equal(trip.title, "Đà Nẵng 4 ngày");
    assert.equal(trip.budget, 5_000_000);
  });

  test("a one-off date stays one-off after a title patch", async () => {
    const { id } = await couple.a.caller.specialDate.create({
      title: "Buổi phỏng vấn",
      date: "2026-05-20",
      recurYearly: false,
    });
    await couple.a.caller.specialDate.update({ id, title: "Buổi phỏng vấn (dời)" });
    const row = (await couple.a.caller.specialDate.list()).find((d) => d.id === id);
    assert.equal(row?.title, "Buổi phỏng vấn (dời)");
    assert.equal(row?.recurYearly, false, "recurYearly defaults to true — a patch must not turn it back on");
  });

  test("a place keeps everything a rename did not mention", async () => {
    const { id } = await couple.a.caller.location.create({
      name: "Quán cũ",
      district: "Phường Sài Gòn",
      category: "Cà phê",
      mustTry: "Bạc xỉu",
      rating: 5,
      note: "Ngồi tầng 2",
    });
    await couple.a.caller.location.update({ id, name: "Quán mới" });
    const row = (await couple.a.caller.location.list({})).find((d) => d.id === id);
    assert.equal(row?.name, "Quán mới");
    assert.equal(row?.mustTry, "Bạc xỉu");
    assert.equal(row?.rating, 5);
    assert.equal(row?.note, "Ngồi tầng 2");
  });
});
