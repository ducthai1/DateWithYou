/*
 * With no ADMIN_EMAILS configured, nobody is an admin.
 *
 * That is the safe default before the variable is ever set — a deployment
 * that forgot it must lock the blog admin, not open it. The empty list has to
 * be decided before `@/lib/env` parses, so the side-effect import below runs
 * first; it is load-bearing, not a stray line.
 */
import "./_no-admins.ts";
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { freshDatabase, closeDatabase, callerFor, makeUser, rejects } from "./_harness.ts";
import { TEST_ADMIN_EMAIL } from "./_env.ts";

let wouldBeAdmin: ReturnType<typeof callerFor>;

before(async () => {
  await freshDatabase();
  const a = await makeUser({ name: "Quan tri", email: TEST_ADMIN_EMAIL });
  wouldBeAdmin = callerFor({ userId: a.id, userEmail: a.email });
});

after(closeDatabase);

describe("an unset allowlist fails closed", () => {
  test("the address that would normally be an admin is refused", async () => {
    assert.equal(await wouldBeAdmin.blog.amIAdmin(), false);
    await rejects(() => wouldBeAdmin.blog.adminList(), "FORBIDDEN");
    await rejects(() => wouldBeAdmin.blog.create({ title: "Không ai đăng được" }), "FORBIDDEN");
  });
});
