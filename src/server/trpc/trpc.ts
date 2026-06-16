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
    const match = cookieStr.match(/active_space_id=([^;]+)/);
    if (match) activeSpaceId = match[1];
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
  
  let space = null;
  
  // Try to load the active space from cookie first
  if (ctx.activeSpaceId) {
    space = await SpaceModel.findOne({ _id: ctx.activeSpaceId, members: ctx.userId })
      .select("_id")
      .lean<{ _id: unknown }>();
  }

  // Fallback to finding any space the user belongs to (e.g. they just joined or haven't selected)
  if (!space) {
    space = await SpaceModel.findOne({ members: ctx.userId })
      .select("_id")
      .lean<{ _id: unknown }>();
  }

  if (!space) throw new TRPCError({ code: "FORBIDDEN", message: "NO_SPACE" });
  
  return next({ ctx: { userId: ctx.userId, spaceId: String(space._id), activeSpaceId: ctx.activeSpaceId } });
});
