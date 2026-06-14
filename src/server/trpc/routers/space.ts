import { z } from "zod";
import { createHash } from "node:crypto";
import { customAlphabet } from "nanoid";
import { TRPCError } from "@trpc/server";
import { router, authedProcedure, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { SpaceModel } from "@/server/db/models/space";
import { resolveMemberProfiles } from "@/server/auth/member-profiles";
import { mergeTags, type Tag } from "@/lib/plan-meta";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

type MemberProfileOverride = {
  userId: string;
  nickname?: string;
  avatarEmoji?: string;
  avatarColor?: string;
};

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

  // Member display profiles (name + avatar from Better Auth, with optional
  // couple-set nickname/emoji/colour overrides) — powers the assignee picker.
  members: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    const space = await SpaceModel.findById(ctx.spaceId).lean<{
      members: string[];
      memberProfiles?: MemberProfileOverride[];
    }>();
    if (!space) throw new TRPCError({ code: "FORBIDDEN", message: "NO_SPACE" });
    const profiles = await resolveMemberProfiles(space.members);
    const overrides = new Map(
      (space.memberProfiles ?? []).map((p) => [p.userId, p]),
    );
    return profiles.map((p) => {
      const o = overrides.get(p.id);
      return {
        id: p.id,
        name: o?.nickname || p.name,
        image: p.image,
        avatarEmoji: o?.avatarEmoji ?? null,
        avatarColor: o?.avatarColor ?? null,
        isSelf: p.id === ctx.userId,
      };
    });
  }),

  // Tag palette = built-in defaults + this space's custom tags.
  tags: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    const space = await SpaceModel.findById(ctx.spaceId)
      .select("tags")
      .lean<{ tags?: Tag[] }>();
    return mergeTags(space?.tags);
  }),

  addTag: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(24),
        color: hexColor,
        icon: z.string().trim().max(8).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const space = await SpaceModel.findById(ctx.spaceId).select("tags");
      if (!space) throw new TRPCError({ code: "FORBIDDEN", message: "NO_SPACE" });
      const tags: Tag[] = space.get("tags") ?? [];
      // Idempotent by name (case-insensitive) so quick-add never duplicates.
      if (tags.some((t) => t.name.toLowerCase() === input.name.toLowerCase())) {
        return { ok: true };
      }
      tags.push({ name: input.name, color: input.color, icon: input.icon });
      space.set("tags", tags);
      await space.save();
      return { ok: true };
    }),

  setMemberProfile: protectedProcedure
    .input(
      z.object({
        nickname: z.string().trim().max(24).optional(),
        avatarEmoji: z.string().trim().max(8).optional(),
        avatarColor: hexColor.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const space = await SpaceModel.findById(ctx.spaceId).select("memberProfiles");
      if (!space) throw new TRPCError({ code: "FORBIDDEN", message: "NO_SPACE" });
      const profiles: MemberProfileOverride[] = space.get("memberProfiles") ?? [];
      const next = profiles.filter((p) => p.userId !== ctx.userId);
      next.push({ userId: ctx.userId, ...input });
      space.set("memberProfiles", next);
      await space.save();
      return { ok: true };
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
