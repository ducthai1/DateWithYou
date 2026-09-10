/*
 * Signing a browser into the local app, and the pages worth sweeping.
 *
 * The account is created on first run and reused after, so a suite can be run
 * again and again without wiping anything — and running twice in a row is the
 * point: a harness that resets its state between runs is blind to every bug
 * that only shows on the second visit.
 */
export const TEST_EMAIL = "e2e@example.com";
const TEST_PASSWORD = "e2e-local-password";
const TEST_NAME = "E2E";

/** Screens that draw brand artwork, in rough order of how much they draw. */
export const PAGES_WITH_ART = [
  ["landing", "/"],
  ["tinh-nang", "/tinh-nang"],
  ["khong-biet-di-dau", "/khong-biet-di-dau"],
  ["home", "/home"],
  ["calendar", "/calendar"],
  ["library", "/library"],
];

/** Signs in (creating the account if needed) and puts the tab in a space. */
export async function signIn(page, base, db) {
  await page.goto(`${base}/sign-up`);
  await page.until(`!!document.querySelector('input[name="email"]')`, { timeout: 90000 });
  const body = JSON.stringify({ name: TEST_NAME, email: TEST_EMAIL, password: TEST_PASSWORD });
  const outcome = await page.eval(`(async () => {
    const h = { "content-type": "application/json" };
    const up = await fetch("/api/auth/sign-up/email", { method: "POST", headers: h, body: ${JSON.stringify(body)} });
    if (up.status === 200) return "signed-up";
    const inn = await fetch("/api/auth/sign-in/email", { method: "POST", headers: h, body: ${JSON.stringify(body)} });
    return inn.status === 200 ? "signed-in" : "failed";
  })()`);
  if (outcome === "failed") throw new Error("không đăng nhập được tài khoản e2e");

  const user = await db.collection("user").findOne({ email: TEST_EMAIL });
  const uid = String(user._id);
  let space = await db.collection("spaces").findOne({ createdBy: uid });
  if (!space) {
    const r = await db.collection("spaces").insertOne({
      name: "E2E", members: [uid], themePreset: "terracotta", createdBy: uid,
      isPersonal: false, memberProfiles: [], tags: [], createdAt: new Date(), updatedAt: new Date(),
    });
    space = { _id: r.insertedId };
  }
  // The gender gate covers the screen until it is answered, which would hide
  // every page from the sweep.
  await db.collection("user").updateOne({ _id: user._id }, { $set: { gender: "female" } });
  await page.eval(`localStorage.setItem("dwy:welcomeSeen","1"); document.cookie = "active_space_id=${String(space._id)}; path=/; max-age=31536000"`);
  return { uid, spaceId: String(space._id) };
}
