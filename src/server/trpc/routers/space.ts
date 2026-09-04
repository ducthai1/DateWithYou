import mongoose from "mongoose";
import { REACTION_BAR_SIZE, REACTION_EMOJIS, normaliseReactionBar } from "@/lib/reactions";
import { z } from "zod";
import { createHash } from "node:crypto";
import { customAlphabet } from "nanoid";
import { TRPCError } from "@trpc/server";
import { router, authedProcedure, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { SpaceModel } from "@/server/db/models/space";
import { SpecialDateModel } from "@/server/db/models/special-date";
import { deleteSpaceAndData } from "@/server/db/delete-space-cascade";
import { resolveMemberProfiles } from "@/server/auth/member-profiles";
import { mergeTags, type Tag } from "@/lib/plan-meta";
import { THEME_PRESET_KEYS, resolveThemeKey } from "@/lib/theme-presets";
import { todayKey } from "@/lib/date-keys";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
// Server-side validation: only known preset keys accepted, not arbitrary strings.
const themePresetKey = z.enum(THEME_PRESET_KEYS as [string, ...string[]]);

type MemberProfileOverride = {
  /** This member's own reaction bar, in the order they want it. */
  reactionFavourites?: string[];
  userId: string;
  nickname?: string;
  avatarEmoji?: string;
  avatarColor?: string;
};

// Unambiguous alphabet (no 0/O/1/I), 10 chars → hard to brute-force.
const generateInviteCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 10);
const hashCode = (code: string) =>
  createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
// Delete-PINs are user-chosen secrets, so (unlike invite codes) we keep case
// and don't uppercase — but still trim surrounding whitespace.
const hashPin = (pin: string) =>
  createHash("sha256").update(pin.trim()).digest("hex");
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

  // Returns the user's Google profile picture URL by decoding the stored
  // idToken JWT from the account collection. No OAuth redirect needed.
  getGoogleAvatar: authedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    const db = mongoose.connection.db!;

    // Find the user's Google account in Better Auth's account collection.
    // Better Auth stores userId as ObjectId, but ctx.userId is a string,
    // so we query with both formats to ensure a match.
    const userIdVariants: unknown[] = [ctx.userId];
    try { userIdVariants.push(new mongoose.Types.ObjectId(ctx.userId)); } catch { /* not a valid ObjectId */ }

    const account = await db.collection("account").findOne({
      userId: { $in: userIdVariants },
      providerId: "google",
    });

    if (!account) return { url: null };

    // Try to extract picture from idToken (JWT)
    if (account.idToken && typeof account.idToken === "string") {
      try {
        const parts = account.idToken.split(".");
        if (parts.length >= 2) {
          // Base64url decode the payload
          const payload = JSON.parse(
            Buffer.from(parts[1], "base64url").toString("utf-8"),
          );
          if (payload.picture) return { url: payload.picture as string };
        }
      } catch {
        // idToken decode failed, continue to fallback
      }
    }

    // Fallback: try the accessToken to call Google userinfo
    if (account.accessToken && typeof account.accessToken === "string") {
      try {
        const res = await fetch(
          "https://www.googleapis.com/oauth2/v2/userinfo",
          { headers: { Authorization: `Bearer ${account.accessToken}` } },
        );
        if (res.ok) {
          const data = await res.json();
          if (data.picture) return { url: data.picture as string };
        }
      } catch {
        // API call failed, give up
      }
    }

    return { url: null };
  }),

  getMine: authedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();

    type SpaceLean = {
      _id: unknown;
      name: string;
      themeColor: string;
      themePreset?: string;
      coverImage?: string;
      members: string[];
      createdBy?: string;
      isPersonal?: boolean;
      pin?: string;
      pinHash?: string;
    };

    const activeSpaceId = ctx.activeSpaceId ?? "";
    let space: SpaceLean | null = null;

    if (activeSpaceId) {
      try {
        space = await SpaceModel.findOne({
          _id: activeSpaceId,
          members: ctx.userId,
        }).lean<SpaceLean>();
      } catch {
        // A truncated/garbage cookie fails _id casting. From the caller's point
        // of view that is identical to "no such space" — handled below.
        space = null;
      }

      if (!space) {
        // Mirrors protectedProcedure: an active-space cookie that resolves to
        // nothing must NOT silently fall back to some other space. getMine is
        // what labels the screen, so falling back would show Space A's name
        // while every protectedProcedure call targets a different space.
        // Exception: a user with no space at all still gets `null` so the
        // SpaceGuard can bounce them to /onboarding instead of an error page.
        const hasAnySpace = await SpaceModel.exists({ members: ctx.userId });
        if (!hasAnySpace) return null;
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "STALE_SPACE" });
      }
    } else {
      // No cookie at all (fresh session): any space the user belongs to is a
      // legitimate default — there is no user intent to contradict.
      space = await SpaceModel.findOne({ members: ctx.userId }).lean<SpaceLean>();
    }

    if (!space) return null;
    
    // Fetch members' details. Handle both string IDs and ObjectIds to be safe.
    const memberIds = space.members.flatMap((id) => {
      try { return [id, new mongoose.Types.ObjectId(id)]; }
      catch { return [id]; }
    });
    
     
    const membersData = await mongoose.connection.db!
      .collection("user")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .find({ _id: { $in: memberIds } } as any)
      .project({ _id: 1, name: 1, email: 1, image: 1 })
      .toArray();

    return {
      id: String(space._id),
      name: space.name,
      // themeColor kept for legacy callers but themePreset is the render source
      themeColor: space.themeColor,
      // resolveThemeKey falls back to "terracotta" for legacy docs missing the field
      themePreset: resolveThemeKey(space.themePreset),
      coverImage: space.coverImage ?? null,
      memberCount: space.members.length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      membersData: membersData.map((u: any) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        image: u.image,
      })),
      createdBy: space.createdBy ?? space.members[0],
      isPersonal: space.isPersonal ?? false,
      // Lets the settings UI pick the right delete gate (PIN vs type-the-name).
      hasPin: Boolean(space.pinHash || space.pin),
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
        const pin = input.pin?.trim();
        const doc = await SpaceModel.create({
          name: input.name,
          members: [ctx.userId],
          themePreset: "terracotta",
          // Optional delete-PIN, stored hashed (never plaintext).
          pinHash: pin ? hashPin(pin) : undefined,
          createdBy: ctx.userId,
          isPersonal: input.isPersonal ?? false,
        });
        const spaceId = String(doc._id);

        // Seed exactly one special date, and only one that is actually true:
        // the day this space was created. Earlier this seeded an "anniversary"
        // and a "birthday" too, both dated to account-creation day — neither
        // was information anyone entered, so the countdown, calendar and /home
        // presented an invented relationship claim as if the couple had typed
        // it in. A birthday nobody typed has no honest value at all, so it's
        // gone; the real anniversary already has its own home (Space.anniversaryDate,
        // set from /settings and surfaced by dashboard/stats), so this seed
        // doesn't need to imitate it. "Ngày mở góc riêng" only claims what is
        // verifiably true today — the space itself just opened — and avoids
        // "tụi mình" since isPersonal spaces have a single member, not a couple.
        // Not recurYearly: it's a one-time note ("welcome, this is day one"),
        // not a yearly milestone the couple asked to keep celebrating — it
        // shows today, then quietly drops out of the countdown, leaving room
        // for the couple's own recurring dates (added via the special-dates
        // panel) instead of an app-invented one competing with them forever.
        // create-only: never called again so couple edits are never overwritten.
        await SpecialDateModel.insertMany([
          {
            spaceId,
            createdBy: ctx.userId,
            title: "Ngày mở góc riêng",
            icon: "sparkles",     // registry key — resolveIcon renders Sparkles
            date: todayKey(),     // Saigon-local day, matching how the rest of
                                   // the app buckets "today" (see date-keys.ts)
            recurYearly: false,
          },
        ]);

        return { id: spaceId };
      } catch (e) {
        throw e;
      }
    }),

  // Issues a single-use, hashed, TTL'd code for the ACTIVE space. Returns
  // plaintext once.
  //
  // Was authedProcedure re-resolving the space itself: cookie first, then an
  // unsorted, tie-break-free `findOne({ members: ctx.userId })`. A user who
  // belongs to more than one space (getAllMine exists, and personal spaces are
  // auto-created) could sit in Space B, tap "invite partner", and be handed a
  // code that joins Space A — the partner then lands in the wrong space, and
  // the code is spent. protectedProcedure resolves spaceId in exactly one
  // place, so there is nothing left here to disagree with the UI.
  createInvite: protectedProcedure.mutation(async ({ ctx }) => {
    await connectToDatabase();
    const space = await SpaceModel.findOne({ _id: ctx.spaceId, members: ctx.userId });

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

  // Creator-only, irreversible. A space with a delete-PIN requires the exact
  // PIN; one without (legacy/onboarding-skipped) requires typing the space name
  // — so no space is ever deletable by an empty or arbitrary string. Removes
  // every space-scoped record, not just the space doc.
  delete: protectedProcedure
    .input(z.object({ pin: z.string().optional(), confirmName: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const space = await SpaceModel.findById(ctx.spaceId).lean<{
        name: string;
        createdBy?: string;
        pin?: string;
        pinHash?: string;
        isPersonal?: boolean;
      }>();

      if (!space) throw new TRPCError({ code: "NOT_FOUND", message: "Space not found" });
      if (space.isPersonal) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot delete personal space" });
      if (space.createdBy !== ctx.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Only creator can delete" });

      if (space.pinHash || space.pin) {
        const pin = input.pin?.trim() ?? "";
        // pinHash is canonical; fall back to a legacy plaintext compare.
        const ok = space.pinHash ? hashPin(pin) === space.pinHash : pin === space.pin;
        if (!pin || !ok)
          throw new TRPCError({ code: "FORBIDDEN", message: "Mã PIN không đúng" });
      } else if (input.confirmName?.trim() !== space.name.trim()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Tên không gian không khớp" });
      }

      await deleteSpaceAndData(ctx.spaceId);
      return { ok: true };
    }),

  // Set, change, or clear (empty string) the creator's delete-PIN for the
  // active space — so a space created without one can be protected later.
  setPin: protectedProcedure
    .input(z.object({ pin: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const space = await SpaceModel.findById(ctx.spaceId).lean<{ createdBy?: string }>();
      if (!space) throw new TRPCError({ code: "NOT_FOUND", message: "Space not found" });
      if (space.createdBy !== ctx.userId)
        throw new TRPCError({ code: "FORBIDDEN", message: "Only creator can set PIN" });

      const pin = input.pin.trim();
      await SpaceModel.findByIdAndUpdate(
        ctx.spaceId,
        pin
          ? { $set: { pinHash: hashPin(pin) }, $unset: { pin: "" } }
          : { $unset: { pinHash: "", pin: "" } },
      );
      return { ok: true, hasPin: pin.length > 0 };
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
        // The raw override as well as the resolved name: the settings field has
        // to know whether it is showing a nickname or the account's own name,
        // and `name` alone cannot say which.
        nickname: o?.nickname ?? null,
        // The name the account was created with, kept beside the override so a
        // field can say whose nickname it is editing even when the nickname is
        // the only thing on screen.
        accountName: p.name,
        image: p.image,
        avatarEmoji: o?.avatarEmoji ?? null,
        avatarColor: o?.avatarColor ?? null,
        // Always a full, valid bar — the client should never have to decide
        // what to show when the stored list is short or holds a retired emoji.
        reactionBar: normaliseReactionBar(o?.reactionFavourites),
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

  /**
   * A nickname for anyone in this space, including the person setting it.
   *
   * Shared, not private: the name lives on the member it describes, so both
   * people see the same one — the way it works in a chat, where a nickname is
   * something the two of you agreed on rather than a private label one of you
   * keeps. Blank clears it and the account's own name comes back.
   *
   * Scoped to members of the caller's space, so nobody can rename a stranger.
   */
  setNickname: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        nickname: z.string().trim().max(24),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const space = await SpaceModel.findById(ctx.spaceId).select("members memberProfiles");
      if (!space) throw new TRPCError({ code: "FORBIDDEN", message: "NO_SPACE" });
      const members: string[] = space.get("members") ?? [];
      if (!members.includes(input.userId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Người này không ở trong không gian" });
      }
      const profiles: MemberProfileOverride[] = space.get("memberProfiles") ?? [];
      const theirs = profiles.find((p) => p.userId === input.userId);
      const next = profiles.filter((p) => p.userId !== input.userId);
      // Merge, so setting a nickname never clears their avatar or reaction bar.
      next.push({ ...theirs, userId: input.userId, nickname: input.nickname || undefined });
      space.set("memberProfiles", next);
      await space.save();
      return { ok: true };
    }),

  setMemberProfile: protectedProcedure
    .input(
      z.object({
        // Nickname is NOT here: it belongs to whoever it names, and either
        // person may set it. setNickname owns that field alone, so there is
        // never a second path writing it.
        avatarEmoji: z.string().trim().max(8).optional(),
        avatarColor: hexColor.optional(),
        reactionFavourites: z.array(z.enum(REACTION_EMOJIS)).max(REACTION_BAR_SIZE).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const space = await SpaceModel.findById(ctx.spaceId).select("memberProfiles");
      if (!space) throw new TRPCError({ code: "FORBIDDEN", message: "NO_SPACE" });
      const profiles: MemberProfileOverride[] = space.get("memberProfiles") ?? [];
      /*
       * Merge, not replace.
       *
       * This used to push a fresh object built from `input` alone, so saving a
       * nickname erased the avatar emoji and colour the same person had chosen
       * earlier — every field this mutation did not happen to carry was
       * dropped. Each call now edits only what it was given.
       */
      const mine = profiles.find((p) => p.userId === ctx.userId);
      const next = profiles.filter((p) => p.userId !== ctx.userId);
      next.push({ ...mine, userId: ctx.userId, ...input });
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
