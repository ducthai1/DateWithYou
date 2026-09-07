import { z } from "zod";
import { TRPCError } from "@trpc/server";
import mongoose, { Types } from "mongoose";
import { router, authedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { asGender } from "@/server/auth/member-profiles";

/**
 * The part of a person's profile that belongs to the ACCOUNT, not to a couple
 * space.
 *
 * Gender lives here rather than in `space.memberProfiles` for two reasons a
 * space-scoped field could not satisfy: it has to be writable the moment
 * someone signs up (a fresh account has no space yet), and it describes the
 * person rather than the couple, so it should follow them if the space changes.
 *
 * Written straight onto Better Auth's `user` collection through the Mongoose
 * connection — the same way `resolveMemberProfiles` reads it. That avoids
 * declaring an auth `additionalFields` schema for one string, and the adapter
 * is indifferent to extra keys on the document.
 *
 * `authedProcedure`, not `protectedProcedure`: requiring space membership would
 * lock out exactly the case this exists for.
 */
export const GENDERS = ["male", "female"] as const;

function objectIdOf(userId: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(userId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Tài khoản không hợp lệ" });
  }
  return new Types.ObjectId(userId);
}

export const profileRouter = router({
  /** The signed-in person's own gender, or null when they have not been asked. */
  me: authedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    const doc = await mongoose.connection
      .collection("user")
      .findOne({ _id: objectIdOf(ctx.userId) }, { projection: { gender: 1 } });
    return { gender: asGender(doc?.gender) };
  }),

  /**
   * Set your own gender. Only ever your own — one person does not get to
   * declare this about the other, even inside a shared space.
   */
  setGender: authedProcedure
    .input(z.object({ gender: z.enum(GENDERS) }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      await mongoose.connection
        .collection("user")
        .updateOne({ _id: objectIdOf(ctx.userId) }, { $set: { gender: input.gender } });
      return { ok: true };
    }),
});
