import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { auth } from "@/server/auth/auth";
import { connectToDatabase } from "@/server/db/connect";
import { SpaceModel } from "@/server/db/models/space";
import { env } from "@/lib/env";
import { logServerError } from "@/server/lib/log-error";

/**
 * tRPC context resolves the logged-in user from the session cookie.
 * `spaceId` is resolved per-request inside `protectedProcedure` so every
 * feature query is scoped to the caller's couple space — the client never
 * supplies a spaceId.
 */
export async function createTRPCContext(opts: FetchCreateContextFnOptions) {
  const session = await auth.api.getSession({ headers: opts.req.headers });
  
  // Parse active_space_id from cookie
  let activeSpaceId: string | null = null;
  const cookieStr = opts.req.headers.get("cookie");
  if (cookieStr) {
    // Anchor on a cookie boundary so a differently-named cookie ending in
    // "active_space_id" can't shadow ours; decode in case the value was encoded.
    const match = cookieStr.match(/(?:^|;\s*)active_space_id=([^;]+)/);
    if (match) activeSpaceId = decodeURIComponent(match[1]);
  }

  /*
   * Danh sách không gian: tra MỘT LẦN cho cả request, không phải mỗi thủ tục.
   *
   * `httpBatchLink` gộp nhiều thủ tục vào một request HTTP, nhưng middleware
   * thì chạy lại cho TỪNG thủ tục — nên màn hình đầu tiên (4 thủ tục trong một
   * mẻ) gửi bốn lần cùng một `SpaceModel.find({ members })` xuống Atlas trước
   * khi có bất kỳ việc thật nào. Với RTT đo được 130ms thì đó là ~390ms trả
   * cho con số không.
   *
   * Lười và nhớ: chưa ai hỏi thì không tra, và hỏi lần thứ hai thì nhận lại
   * đúng lời hứa cũ. Context sống đúng một request nên không có chuyện dùng
   * nhầm của người khác.
   */
  return {
    userId: session?.user?.id ?? null,
    userEmail: session?.user?.email ?? null,
    activeSpaceId,
    loadSpaces: makeSpaceLoader(),
  };
}

type SpaceRow = { _id: unknown };

/**
 * Một lời hứa cho cả request, dựng mới cho mỗi request.
 *
 * Tách ra hàm riêng vì có ba nơi dựng context: đường HTTP thật, caller cho
 * Server Component, và bộ kiểm API. Ba nơi phải cùng một hành vi, nếu không
 * thì bài kiểm đo một thứ khác với thứ chạy thật.
 */
export function makeSpaceLoader(): (userId: string) => Promise<SpaceRow[]> {
  let spaces: Promise<SpaceRow[]> | null = null;
  return (userId: string) => {
    /*
     * `.exec()` — nhớ LỜI HỨA, không nhớ Query.
     *
     * `find().lean()` trả về một Query của Mongoose, và một Query chỉ chạy được
     * đúng một lần: `await` lần thứ hai ném "Query was already executed". Tức
     * là bản thiếu `.exec()` sẽ hỏng ngay ở thủ tục THỨ HAI trong mọi mẻ — đúng
     * cái mà việc nhớ này sinh ra để phục vụ. 218 bài API đỏ đã nói điều đó
     * trước khi nó kịp lên production.
     */
    spaces ??= SpaceModel.find({ members: userId }).select("_id").lean<SpaceRow[]>().exec();
    return spaces;
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

/*
 * Every procedure reports its own failures.
 *
 * Attached at the base so nothing has to remember to — a feature added next
 * month is watched the day it ships, which is the only way this stays true.
 *
 * Only unexpected failures are recorded. A FORBIDDEN, a NOT_FOUND, a
 * BAD_REQUEST: those are the app working, and logging them would bury the one
 * error that means something under a thousand that do not.
 */
const EXPECTED = new Set([
  "BAD_REQUEST", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND",
  "CONFLICT", "PRECONDITION_FAILED", "TOO_MANY_REQUESTS", "PARSE_ERROR",
]);

const reportFailures = t.middleware(async ({ ctx, path, next }) => {
  const result = await next();
  if (!result.ok) {
    const code = (result.error as { code?: string }).code;
    if (!code || !EXPECTED.has(code)) {
      // Deliberately not awaited: a slow write must not hold up the response
      // that is already on its way to somebody.
      void logServerError(`trpc:${path}`, result.error, {
        userId: ctx.userId,
        spaceId: (ctx as { spaceId?: string }).spaceId ?? null,
      });
    }
  }
  return result;
});

export const publicProcedure = t.procedure.use(reportFailures);

/** Requires an authenticated user (no space membership required). */
export const authedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { userId: ctx.userId } });
});

/** The set of blog admins, from ADMIN_EMAILS (comma-separated). Compared
 *  case-insensitively — better-auth lowercases stored emails, but a config
 *  value pasted by hand may not. */
const ADMIN_EMAILS = new Set(
  (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

/** True when this email is on the blog-admin allowlist (case-insensitive). */
export function isBlogAdmin(email: string | null | undefined): boolean {
  const e = email?.toLowerCase();
  return !!e && ADMIN_EMAILS.has(e);
}

/**
 * Requires a logged-in user whose email is in ADMIN_EMAILS.
 *
 * Blog posts are not space-scoped (they are public content), so this does NOT
 * extend protectedProcedure — it authorises on identity alone. An empty
 * ADMIN_EMAILS means nobody passes, which is the safe default before the var
 * is set.
 */
export const adminProcedure = authedProcedure.use(async ({ ctx, next }) => {
  const email = ctx.userEmail?.toLowerCase();
  if (!isBlogAdmin(email)) throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx: { userId: ctx.userId, userEmail: email } });
});

/**
 * Requires an authenticated user who belongs to a couple space.
 * Resolves `spaceId` from membership — the tenant-isolation seam every
 * feature router builds on. Throws FORBIDDEN/NO_SPACE if the user has no space.
 */
export const protectedProcedure = authedProcedure.use(async ({ ctx, next }) => {
  await connectToDatabase();

  // Một vòng đi-về cho CẢ REQUEST, không phải mỗi thủ tục — xem `loadSpaces`
  // trong `createTRPCContext`. Trước đây mỗi thủ tục trong một mẻ tự tra lại.
  const spaces = await ctx.loadSpaces(ctx.userId);

  if (!spaces.length) throw new TRPCError({ code: "FORBIDDEN", message: "NO_SPACE" });

  const activeSpaceIdStr = ctx.activeSpaceId ?? "";

  if (activeSpaceIdStr) {
    const active = spaces.find((s) => String(s._id) === activeSpaceIdStr);
    /*
     * The caller SENT an active-space cookie and it matches none of their
     * spaces (stale value, truncated cookie, or a space they have since left).
     *
     * Falling back to spaces[0] here is silently wrong, not merely imprecise:
     * find() has no sort, so "first" is whatever order the server returns.
     * The UI still believes the cookie's space is active, so a create/update
     * mutation would be written into a DIFFERENT couple's space than the one
     * on screen — cross-tenant data written with no error anywhere. Refusing
     * loudly lets the client clear the cookie and re-pick a space (the space
     * switcher runs on getAllMine, an authedProcedure, so recovery still works
     * while every protectedProcedure is failing).
     */
    if (!active)
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "STALE_SPACE" });

    return next({
      ctx: { userId: ctx.userId, spaceId: String(active._id), activeSpaceId: ctx.activeSpaceId },
    });
  }

  // No cookie at all (fresh session / first load): defaulting to a space the
  // user genuinely belongs to is the intended behaviour, not a guess at which
  // of several the user *meant*.
  const space = spaces[0]!;
  return next({ ctx: { userId: ctx.userId, spaceId: String(space._id), activeSpaceId: ctx.activeSpaceId } });
});
