import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { auth } from "@/server/auth/auth";
import { connectToDatabase } from "@/server/db/connect";
import { SpaceModel } from "@/server/db/models/space";

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

  return { userId: session?.user?.id ?? null, activeSpaceId };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

/** Requires an authenticated user (no space membership required). */
export const authedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { userId: ctx.userId } });
});

/**
 * Requires an authenticated user who belongs to a couple space.
 * Resolves `spaceId` from membership — the tenant-isolation seam every
 * feature router builds on. Throws FORBIDDEN/NO_SPACE if the user has no space.
 */
export const protectedProcedure = authedProcedure.use(async ({ ctx, next }) => {
  await connectToDatabase();

  // Single round-trip: fetch all spaces this user belongs to (couples app → 1-2 max),
  // then pick the activeSpaceId one when valid, otherwise fall back to the first.
  // Previously two sequential findOne calls; now one find() saves one Atlas RTT.
  const spaces = await SpaceModel.find({ members: ctx.userId })
    .select("_id")
    .lean<{ _id: unknown }[]>();

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
