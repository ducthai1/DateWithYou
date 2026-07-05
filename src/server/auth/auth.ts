import "server-only";
import { betterAuth } from "better-auth";
import { oneTap } from "better-auth/plugins";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";

/**
 * Better Auth needs a Db at synchronous construction time, while Mongoose's
 * client only exists after an async connect — so a single shared pool isn't
 * feasible. Instead Better Auth gets its own MongoClient with a small pool and
 * Mongoose (app data) also caps its pool, keeping total connections well under
 * Atlas M0's ~500 cap (the real risk behind the connection-authority concern).
 *
 * Fallbacks keep `next build` working without secrets; real values are required
 * at runtime (set them in `.env.local`).
 */
const uri = env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/chuyen-cua-ca";

const globalForAuthDb = globalThis as unknown as {
  _authMongoClient?: MongoClient;
};
const client =
  globalForAuthDb._authMongoClient ?? new MongoClient(uri, { maxPoolSize: 5 });
globalForAuthDb._authMongoClient = client;

export const auth = betterAuth({
  database: mongodbAdapter(client.db(), { client }),
  secret: env.BETTER_AUTH_SECRET ?? "dev-insecure-secret-change-me",
  baseURL: env.BETTER_AUTH_URL ?? "http://localhost:4488",
  // Origin allow-list (Better Auth's CSRF guard). In dev we trust both localhost
  // and 127.0.0.1 on the app port so "Invalid origin" never depends on which
  // host string the browser used. Extra origins (e.g. a LAN IP for phone
  // testing) can be added via BETTER_AUTH_TRUSTED_ORIGINS without a code change.
  trustedOrigins: [
    ...(process.env.NODE_ENV === "production"
      ? []
      : ["http://localhost:4488", "http://127.0.0.1:4488"]),
    // Vercel assigns a fresh URL per deployment plus a stable production URL,
    // both injected at runtime. Trust them so the CSRF origin check passes on
    // preview deploys and the production alias even when BETTER_AUTH_URL pins a
    // single canonical origin — otherwise every *.vercel.app host is rejected.
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
      : []),
    ...(env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
      .map((o) => o.trim())
      .filter(Boolean) ?? []),
  ],
  session: {
    // Cache the session in a short-lived signed cookie so most requests resolve
    // the user without a DB round-trip. Every tRPC call goes through
    // getSession; against a remote Atlas cluster that round-trip dominates
    // navigation latency. 5 min is the revocation lag we accept for it.
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  emailAndPassword: {
    enabled: true,
    // v1 keeps sign-up frictionless: no email verification, and a tiny password
    // floor so registering means using the app immediately. Invite codes (not
    // verification) gate who can join a couple space.
    requireEmailVerification: false,
    minPasswordLength: 1,
    autoSignIn: true,
    sendResetPassword: async ({ user, url }) => {
      const html = `
        <div style="font-family: 'Inter', Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 20px;">
          <div style="background-color: #ffffff; padding: 40px; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.05); text-align: center;">
            <div style="width: 50px; height: 50px; background-color: #FEE2E2; border-radius: 16px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </div>
            <h1 style="color: #111827; font-size: 24px; font-weight: 700; margin-bottom: 12px; margin-top: 0;">Khôi phục mật khẩu</h1>
            <p style="color: #4B5563; font-size: 15px; line-height: 1.6; margin-bottom: 32px;">
              Chào ${user.name || "bạn"},<br><br>
              Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn tại <strong>Vivu No Plan</strong>. Nhấn vào nút bên dưới để tạo mật khẩu mới.
            </p>
            <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #EF4444 0%, #B91C1C 100%); color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);">
              Đặt lại mật khẩu
            </a>
            <p style="color: #9CA3AF; font-size: 13px; line-height: 1.5; margin-top: 32px; margin-bottom: 0;">
              Nếu bạn không yêu cầu điều này, xin vui lòng bỏ qua email này. Link sẽ hết hạn sau một thời gian ngắn.
            </p>
          </div>
        </div>
      `;
      await sendEmail({
        to: user.email,
        subject: "Khôi phục mật khẩu của bạn",
        html,
      });
    },
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  // Server side of Google One Tap. Verifies the ID token the One Tap prompt
  // returns and signs the user in via the same Google account/provider as the
  // redirect button — no separate identity.
  plugins: [oneTap()],
  account: {
    accountLinking: {
      // Disabled in v1: with email verification not hard-blocking, auto-linking
      // would let an attacker pre-register an unverified email/password account
      // and capture a victim's later Google sign-in on the same email. Keeping
      // providers separate closes that takeover path.
      enabled: false,
    },
  },
});

// Fail fast at runtime in production if the real secret/URL weren't provided.
// Skipped during `next build` (phase-production-build) so the build stays green
// without secrets — the fallbacks above only exist for that build step.
if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build" &&
  (!env.BETTER_AUTH_SECRET || !env.MONGODB_URI)
) {
  throw new Error(
    "BETTER_AUTH_SECRET and MONGODB_URI are required in production",
  );
}
