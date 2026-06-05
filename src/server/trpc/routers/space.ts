import { z } from "zod";
import { createHash } from "node:crypto";
import { customAlphabet } from "nanoid";
import { TRPCError } from "@trpc/server";
import { router, authedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { SpaceModel } from "@/server/db/models/space";

// Unambiguous alphabet (no 0/O/1/I), 10 chars → hard to brute-force.
const generateInviteCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 10);
const hashCode = (code: string) =>
  createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

// MongoDB duplicate-key (unique index) error.
const isDuplicateKey = (e: unknown): boolean =>
  typeof e === "object" && e !== null && (e as { code?: number }).code === 11000;

export const spaceRouter = router({
  getMine: authedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    const space = await SpaceModel.findOne({ members: ctx.userId }).lean<{
      _id: unknown;
      name: string;
      themeColor: string;
      coverImage?: string;
      members: string[];
    }>();
    if (!space) return null;
    return {
      id: String(space._id),
      name: space.name,
      themeColor: space.themeColor,
      coverImage: space.coverImage ?? null,
      memberCount: space.members.length,
    };
  }),

  // One space per user in v1. Reject if already a member of any space.
  create: authedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(60) }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const existing = await SpaceModel.findOne({ members: ctx.userId })
        .select("_id")
        .lean();
      if (existing)
        throw new TRPCError({ code: "CONFLICT", message: "ALREADY_IN_SPACE" });
      try {
        const doc = await SpaceModel.create({
          name: input.name,
          members: [ctx.userId],
        });
        return { id: String(doc._id) };
      } catch (e) {
        // Unique members index → user raced into another space.
        if (isDuplicateKey(e))
          throw new TRPCError({ code: "CONFLICT", message: "ALREADY_IN_SPACE" });
        throw e;
      }
    }),

  // Issues a single-use, hashed, TTL'd code. Returns plaintext once.
  createInvite: authedProcedure.mutation(async ({ ctx }) => {
    await connectToDatabase();
    const space = await SpaceModel.findOne({ members: ctx.userId });
    if (!space) throw new TRPCError({ code: "FORBIDDEN", message: "NO_SPACE" });
    if (space.members.length >= 2)
      throw new TRPCError({ code: "CONFLICT", message: "SPACE_FULL" });
    const code = generateInviteCode();
    space.inviteCodeHash = hashCode(code);
    space.inviteCodeExpiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await space.save();
    return { code };
  }),

  // Atomic join: matches a live code, space not full, not already a member,
  // then invalidates the code in the same update (single-use).
  joinByCode: authedProcedure
    .input(z.object({ code: z.string().min(1).max(32) }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const already = await SpaceModel.findOne({ members: ctx.userId })
        .select("_id")
        .lean();
      if (already)
        throw new TRPCError({ code: "CONFLICT", message: "ALREADY_IN_SPACE" });

      let joined;
      try {
        joined = await SpaceModel.findOneAndUpdate(
          {
            inviteCodeHash: hashCode(input.code),
            inviteCodeExpiresAt: { $gt: new Date() },
            members: { $ne: ctx.userId },
            $expr: { $lt: [{ $size: "$members" }, 2] },
          },
          {
            $addToSet: { members: ctx.userId },
            $unset: { inviteCodeHash: "", inviteCodeExpiresAt: "" },
          },
          { new: true },
        )
          .select("_id")
          .lean<{ _id: unknown }>();
      } catch (e) {
        // Unique members index → user already belongs to another space.
        if (isDuplicateKey(e))
          throw new TRPCError({ code: "CONFLICT", message: "ALREADY_IN_SPACE" });
        throw e;
      }

      if (!joined)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "INVALID_OR_EXPIRED_CODE",
        });
      return { id: String(joined._id) };
    }),

  updateTheme: authedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(60).optional(),
        themeColor: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        coverImage: z.string().url().startsWith("https://").optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const res = await SpaceModel.findOneAndUpdate(
        { members: ctx.userId },
        { $set: input },
        { new: true },
      )
        .select("_id")
        .lean();
      if (!res) throw new TRPCError({ code: "FORBIDDEN", message: "NO_SPACE" });
      return { ok: true };
    }),
});
