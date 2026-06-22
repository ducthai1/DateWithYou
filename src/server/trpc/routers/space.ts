import { z } from "zod";
import { createHash } from "node:crypto";
import { customAlphabet } from "nanoid";
import { TRPCError } from "@trpc/server";
import { router, authedProcedure, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { SpaceModel } from "@/server/db/models/space";
import { SpecialDateModel } from "@/server/db/models/special-date";
import { resolveMemberProfiles } from "@/server/auth/member-profiles";
import { mergeTags, type Tag } from "@/lib/plan-meta";
import { THEME_PRESET_KEYS, resolveThemeKey } from "@/lib/theme-presets";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
// Server-side validation: only known preset keys accepted, not arbitrary strings.
const themePresetKey = z.enum(THEME_PRESET_KEYS as [string, ...string[]]);

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

export const spaceRouter = router({
  getAllMine: authedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    const spaces = await SpaceModel.find({ members: ctx.userId })
      .select("_id name themePreset coverImage members createdBy isPersonal")
      .lean<{ _id: unknown; name: string; themePreset?: string; coverImage?: string; members: string[]; createdBy?: string; isPersonal?: boolean }[]>();
    
    return spaces.map((s) => ({
      id: String(s._id),
      name: s.name,
      themePreset: resolveThemeKey(s.themePreset),
      coverImage: s.coverImage ?? null,
      memberCount: s.members.length,
      createdBy: s.createdBy ?? s.members[0],
      isPersonal: s.isPersonal ?? false,
    }));
  }),

  getMine: authedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    let space = null;
    
    if (ctx.activeSpaceId) {
      space = await SpaceModel.findOne({ _id: ctx.activeSpaceId, members: ctx.userId }).lean<{
        _id: unknown;
        name: string;
        themeColor: string;
        themePreset?: string;
        coverImage?: string;
        members: string[];
        createdBy?: string;
        isPersonal?: boolean;
      }>();
    }
    
    if (!space) {
      space = await SpaceModel.findOne({ members: ctx.userId }).lean<{
        _id: unknown;
        name: string;
        themeColor: string;
        themePreset?: string;
        coverImage?: string;
        members: string[];
        createdBy?: string;
        isPersonal?: boolean;
      }>();
    }

    if (!space) return null;
    return {
      id: String(space._id),
      name: space.name,
      // themeColor kept for legacy callers but themePreset is the render source
      themeColor: space.themeColor,
      // resolveThemeKey falls back to "terracotta" for legacy docs missing the field
      themePreset: resolveThemeKey(space.themePreset),
      coverImage: space.coverImage ?? null,
      memberCount: space.members.length,
      createdBy: space.createdBy ?? space.members[0],
      isPersonal: space.isPersonal ?? false,
    };
  }),

  create: authedProcedure
    .input(z.object({ 
      name: z.string().trim().min(1).max(60),
      pin: z.string().optional(),
      isPersonal: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      try {
        const doc = await SpaceModel.create({
          name: input.name,
          members: [ctx.userId],
          themePreset: "terracotta",
          pin: input.pin,
          createdBy: ctx.userId,
          isPersonal: input.isPersonal ?? false,
        });
        const spaceId = String(doc._id);

        // Seed 2 clearly-placeholder special dates so the countdown banner is
        // never empty on a brand-new space. Both are set to today's date as a
        // sensible starting point — the couple can edit or delete them freely.
        // create-only: never called again so couple edits are never overwritten.
        const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        await SpecialDateModel.insertMany([
          {
            spaceId,
            createdBy: ctx.userId,
            title: "Ngày kỷ niệm",
            icon: "heart",       // registry key — resolveIcon renders a Heart
            date: todayStr,
            recurYearly: true,
          },
          {
            spaceId,
            createdBy: ctx.userId,
            title: "Sinh nhật",
            icon: "cake",        // registry key — resolveIcon renders a Cake
            date: todayStr,
            recurYearly: true,
          },
        ]);

        return { id: spaceId };
      } catch (e) {
        throw e;
      }
    }),

  // Issues a single-use, hashed, TTL'd code. Returns plaintext once.
  createInvite: authedProcedure.mutation(async ({ ctx }) => {
    await connectToDatabase();
    let space = null;
    
    if (ctx.activeSpaceId) {
      space = await SpaceModel.findOne({ _id: ctx.activeSpaceId, members: ctx.userId });
    }
    
    if (!space) {
      space = await SpaceModel.findOne({ members: ctx.userId });
    }

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
        throw e;
      }

      if (!joined)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "INVALID_OR_EXPIRED_CODE",
        });
      return { id: String(joined._id) };
    }),

  delete: protectedProcedure
    .input(z.object({ pin: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const space = await SpaceModel.findById(ctx.spaceId).lean<{ createdBy?: string; pin?: string; isPersonal?: boolean }>();
      
      if (!space) throw new TRPCError({ code: "NOT_FOUND", message: "Space not found" });
      if (space.isPersonal) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot delete personal space" });
      if (space.createdBy !== ctx.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Only creator can delete" });
      // Only enforce the PIN when one was actually set. Spaces created via the
      // onboarding flow have no PIN, so requiring a match made them permanently
      // undeletable; in that case any non-empty PIN the UI collects is accepted.
      if (space.pin && space.pin !== input.pin)
        throw new TRPCError({ code: "FORBIDDEN", message: "Mã PIN không đúng" });
      
      await SpaceModel.findByIdAndDelete(ctx.spaceId);
      // We should also delete related collections (locations, memories, etc.) but for simplicity, we just delete the space doc for now.
      return { ok: true };
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

  updateTheme: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(60).optional(),
        /**
         * Preset key from the theme registry. This is the sole render source —
         * the free-hex themeColor field is retired from the UI/render path.
         * Server validates against THEME_PRESET_KEYS so clients can't inject
         * arbitrary strings into the DB.
         */
        themePreset: themePresetKey.optional(),
        coverImage: z.string().url().startsWith("https://").optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      // Scope to the ACTIVE space (ctx.spaceId), not just any space the user is in.
      // A multi-space user editing settings was previously writing to whichever
      // space matched {members} first — silently renaming/recoloring the wrong one.
      const res = await SpaceModel.findOneAndUpdate(
        { _id: ctx.spaceId, members: ctx.userId },
        { $set: input },
        { new: true },
      )
        .select("_id")
        .lean();
      if (!res) throw new TRPCError({ code: "FORBIDDEN", message: "NO_SPACE" });
      return { ok: true };
    }),
});
