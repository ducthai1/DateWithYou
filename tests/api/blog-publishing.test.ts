/*
 * The blog has two audiences reading one collection.
 *
 * Public procedures may only ever see a post that is published AND whose time
 * has come — that single filter is what makes scheduling work without a cron,
 * and it is also the only thing standing between a half-written draft and the
 * front page. Admin procedures see everything, gated on the email allowlist
 * alone (posts are not space-scoped, so there is no membership to lean on).
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, closeDatabase, callerFor, makeUser, rejects } from "./_harness.ts";
import { TEST_ADMIN_EMAIL } from "./_env.ts";

let admin: ReturnType<typeof callerFor>;
let reader: ReturnType<typeof callerFor>;
const anon = callerFor({});

before(async () => {
  await freshDatabase();
  const a = await makeUser({ name: "Quan tri", email: TEST_ADMIN_EMAIL });
  admin = callerFor({ userId: a.id, userEmail: a.email });
  const r = await makeUser({ name: "Nguoi doc", email: "reader@example.test" });
  reader = callerFor({ userId: r.id, userEmail: r.email });
});

after(closeDatabase);

describe("who may manage posts", () => {
  test("a signed-out visitor cannot reach the admin side", async () => {
    await rejects(() => anon.blog.adminList(), "UNAUTHORIZED");
    await rejects(() => anon.blog.create({ title: "Bài của khách" }), "UNAUTHORIZED");
  });

  test("a signed-in reader who is not on the allowlist is refused", async () => {
    await rejects(() => reader.blog.adminList(), "FORBIDDEN");
    await rejects(() => reader.blog.create({ title: "Bài của người đọc" }), "FORBIDDEN");
    assert.equal(await reader.blog.amIAdmin(), false);
  });

  test("the allowlist is matched case-insensitively", async () => {
    /*
     * Better Auth lowercases what it stores, but a value pasted into the
     * config by hand may not be — so the comparison, not the data, has to
     * be the tolerant side.
     */
    const shouty = callerFor({ userId: "000000000000000000000001", userEmail: TEST_ADMIN_EMAIL.toUpperCase() });
    assert.equal(await shouty.blog.amIAdmin(), true);
    assert.equal(await admin.blog.amIAdmin(), true);
  });
});

describe("draft, scheduled, published", () => {
  test("a draft is invisible to every public read, and visible to the admin", async () => {
    const draft = await admin.blog.create({ title: "Bản nháp chưa xong", excerpt: "nháp", status: "draft" });
    assert.equal(draft.status, "draft");
    assert.equal(draft.publishedAt, null, "a draft has no publish date at all");

    const listed = await anon.blog.list({});
    assert.ok(!listed.items.some((p) => p.slug === draft.slug), "a draft reached the public list");
    await rejects(() => anon.blog.bySlug({ slug: draft.slug }), "NOT_FOUND");
    assert.ok(!(await anon.blog.search({ q: "nháp" })).some((p) => p.slug === draft.slug));
    assert.ok(!(await anon.blog.sitemap()).some((p) => p.slug === draft.slug), "a draft reached the sitemap");

    assert.ok((await admin.blog.adminList()).some((p) => p.slug === draft.slug));
    assert.ok((await admin.blog.adminList({ status: "draft" })).some((p) => p.slug === draft.slug));
  });

  test("publishing stamps the date once and does not move it on a later save", async () => {
    const post = await admin.blog.create({ title: "Bài đầu tiên", status: "published" });
    assert.ok(post.publishedAt, "publishing with no date means now");
    const first = new Date(post.publishedAt).getTime();

    const again = await admin.blog.update({ id: post.id, status: "published", title: "Bài đầu tiên (sửa)" });
    assert.equal(new Date(again.publishedAt!).getTime(), first, "re-saving must not re-date the post");
  });

  test("a post dated in the future is published but stays hidden until then", async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const scheduled = await admin.blog.create({
      title: "Bài hẹn giờ",
      status: "published",
      publishedAt: future,
    });
    assert.equal(scheduled.status, "published");
    await rejects(() => anon.blog.bySlug({ slug: scheduled.slug }), "NOT_FOUND");
    assert.ok(!(await anon.blog.list({})).items.some((p) => p.slug === scheduled.slug));

    // Bringing the date back into the past makes it live with no other change.
    await admin.blog.update({ id: scheduled.id, publishedAt: new Date(Date.now() - 1000) });
    assert.equal((await anon.blog.bySlug({ slug: scheduled.slug })).slug, scheduled.slug);
  });

  test("unpublishing takes it back off the public side", async () => {
    const post = await admin.blog.create({ title: "Bài rút lại", status: "published" });
    assert.equal((await anon.blog.bySlug({ slug: post.slug })).slug, post.slug);
    await admin.blog.update({ id: post.id, status: "draft" });
    await rejects(() => anon.blog.bySlug({ slug: post.slug }), "NOT_FOUND");
  });
});

describe("slugs", () => {
  test("a Vietnamese title becomes an ASCII slug", async () => {
    const post = await admin.blog.create({ title: "Đi chơi không kế hoạch ở Sài Gòn" });
    assert.equal(post.slug, "di-choi-khong-ke-hoach-o-sai-gon");
  });

  test("a second post with the same title gets its own slug", async () => {
    const a = await admin.blog.create({ title: "Mẹo hay cho cặp đôi" });
    const b = await admin.blog.create({ title: "Mẹo hay cho cặp đôi" });
    const c = await admin.blog.create({ title: "Mẹo hay cho cặp đôi" });
    assert.equal(a.slug, "meo-hay-cho-cap-doi");
    assert.equal(b.slug, "meo-hay-cho-cap-doi-2");
    assert.equal(c.slug, "meo-hay-cho-cap-doi-3");
  });

  test("an explicit slug is honoured, and a title with nothing slugifiable still gets one", async () => {
    const chosen = await admin.blog.create({ title: "Tựa đề dài", slug: "duong-dan-tu-chon" });
    assert.equal(chosen.slug, "duong-dan-tu-chon");
    const symbols = await admin.blog.create({ title: "!!! ???" });
    assert.ok(symbols.slug.length > 0, "a post must never end up with an empty slug");
  });

  test("re-saving a post keeps the slug it already has", async () => {
    /*
     * The uniqueness check has to exclude the post being edited, or every
     * save would push it to -2, -3, -4 and break its own published URL.
     */
    const post = await admin.blog.create({ title: "Giữ nguyên đường dẫn" });
    const saved = await admin.blog.update({ id: post.id, slug: post.slug, title: "Giữ nguyên đường dẫn" });
    assert.equal(saved.slug, post.slug);
  });
});

describe("view counting", () => {
  test("only a live post earns a view, and a bad slug is a silent no-op", async () => {
    const post = await admin.blog.create({ title: "Bài được đọc", status: "published" });
    const draft = await admin.blog.create({ title: "Bài nháp không đếm", status: "draft" });

    await anon.blog.recordView({ slug: post.slug });
    await anon.blog.recordView({ slug: post.slug });
    assert.equal((await anon.blog.bySlug({ slug: post.slug })).viewCount, 2);

    // A beacon has nowhere to show an error, so these must not throw.
    await anon.blog.recordView({ slug: draft.slug });
    await anon.blog.recordView({ slug: "khong-ton-tai-bao-gio" });
    assert.equal((await admin.blog.adminGet({ id: draft.id })).viewCount, 0);
  });
});

describe("removing", () => {
  test("a deleted post is gone from both sides", async () => {
    const post = await admin.blog.create({ title: "Bài sẽ bị xoá", status: "published" });
    await admin.blog.remove({ id: post.id });
    await rejects(() => anon.blog.bySlug({ slug: post.slug }), "NOT_FOUND");
    await rejects(() => admin.blog.adminGet({ id: post.id }), "NOT_FOUND");
  });

  test("a reader cannot delete anything", async () => {
    const post = await admin.blog.create({ title: "Bài không ai được xoá", status: "published" });
    await rejects(() => reader.blog.remove({ id: post.id }), "FORBIDDEN");
    assert.equal((await anon.blog.bySlug({ slug: post.slug })).slug, post.slug);
  });
});
