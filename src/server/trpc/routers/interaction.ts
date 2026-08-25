import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { MemoryModel } from "@/server/db/models/memory";
import {
  ReactionModel,
  REACTION_EMOJIS,
  REACTION_TARGET_TYPES,
  type ReactionTargetType,
} from "@/server/db/models/reaction";
import { NoteModel, NOTE_MAX_LENGTH } from "@/server/db/models/note";

/**
 * Reactions and notes on shared objects (memories first).
 *
 * The content model is otherwise one-directional — `memory.createdBy` records
 * who uploaded and nothing lets the other partner answer. A one-tap reaction is
 * the cheapest reciprocity available and works for the partner who never
 * authors anything.
 */

const targetTypeInput = z.enum(REACTION_TARGET_TYPES);
const emojiInput = z.enum(REACTION_EMOJIS);

/**
 * Mongo ObjectId hex. Bounded here so a malformed id is a 400 from zod instead
 * of a Mongoose CastError surfacing as a 500.
 */
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "BAD_ID");

/** How many targets one batched read may cover — keeps the `$in` bounded. */
const MAX_TARGETS = 50;

type ReactionRow = { userId: string; emoji: string };
type NoteRow = { id: string; userId: string; body: string; createdAt: Date };
type TargetInteractions = { reactions: ReactionRow[]; notes: NoteRow[] };

/**
 * Which collection backs each target type. Only "memory" exists today; a new
 * target type must be added here as well as to REACTION_TARGET_TYPES, so the
 * existence guard below can never be silently skipped for it.
 */
const TARGET_MODELS = { memory: MemoryModel } as const;

/**
 * Tenant guard: returns the subset of `targetIds` that really exists inside
 * `spaceId`. Without it a client could attach reactions/notes to another
 * couple's document id. One query for the whole batch, never one per target.
 */
async function targetsInSpace(
  targetType: ReactionTargetType,
  targetIds: string[],
  spaceId: string,
): Promise<Set<string>> {
  if (!targetIds.length) return new Set();
  const docs = await TARGET_MODELS[targetType]
    .find({ _id: { $in: targetIds }, spaceId })
    .select("_id")
    .lean<{ _id: unknown }[]>();
  return new Set(docs.map((d) => String(d._id)));
}

/** Current reactions on one target, serialised for the client. */
async function readReactions(
  spaceId: string,
  targetType: ReactionTargetType,
  targetId: string,
): Promise<ReactionRow[]> {
  const rows = await ReactionModel.find({ spaceId, targetType, targetId })
    .select("userId emoji")
    .lean<{ userId: string; emoji: string }[]>();
  return rows.map((r) => ({ userId: r.userId, emoji: r.emoji }));
}

export const interactionRouter = router({
  /**
   * Reactions + notes for a batch of targets. Two collection reads total
   * (plus the tenant guard), all with `$in` — never one round-trip per card.
   * Targets that don't exist in the caller's space are simply absent from the
   * result rather than returning empty shells for someone else's ids.
   */
  forTargets: protectedProcedure
    .input(
      z.object({
        targetType: targetTypeInput,
        targetIds: z.array(objectId).max(MAX_TARGETS),
      }),
    )
    .query(async ({ ctx, input }) => {
      await connectToDatabase();
      const ids = [...new Set(input.targetIds)];
      const out: Record<string, TargetInteractions> = {};
      if (!ids.length) return out;

      const filter = {
        spaceId: ctx.spaceId,
        targetType: input.targetType,
        targetId: { $in: ids },
      };

      const [valid, reactions, notes] = await Promise.all([
        targetsInSpace(input.targetType, ids, ctx.spaceId),
        ReactionModel.find(filter)
          .select("targetId userId emoji")
          .lean<{ targetId: string; userId: string; emoji: string }[]>(),
        NoteModel.find(filter)
          .sort({ createdAt: 1 })
          .select("targetId userId body createdAt")
          .lean<
            {
              _id: unknown;
              targetId: string;
              userId: string;
              body: string;
              createdAt: Date;
            }[]
          >(),
      ]);

      for (const id of ids) if (valid.has(id)) out[id] = { reactions: [], notes: [] };
      for (const r of reactions) {
        out[r.targetId]?.reactions.push({ userId: r.userId, emoji: r.emoji });
      }
      for (const n of notes) {
        out[n.targetId]?.notes.push({
          id: String(n._id),
          userId: n.userId,
          body: n.body,
          createdAt: n.createdAt,
        });
      }
      return out;
    }),

  /**
   * Toggle semantics: the same emoji twice removes it, a different emoji
   * replaces the existing one, and a first tap creates it.
   *
   * Written as delete-then-upsert rather than read-then-write so two fast taps
   * can't interleave into a lost update. The unique index turns a concurrent
   * double-insert into a duplicate-key error, which is retried as a plain
   * update — never surfaced to the couple.
   */
  react: protectedProcedure
    .input(
      z.object({
        targetType: targetTypeInput,
        targetId: objectId,
        emoji: emojiInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const valid = await targetsInSpace(
        input.targetType,
        [input.targetId],
        ctx.spaceId,
      );
      if (!valid.has(input.targetId))
        throw new TRPCError({ code: "NOT_FOUND", message: "BAD_TARGET" });

      const key = {
        spaceId: ctx.spaceId,
        targetType: input.targetType,
        targetId: input.targetId,
        userId: ctx.userId,
      };

      const removed = await ReactionModel.findOneAndDelete({
        ...key,
        emoji: input.emoji,
      }).lean();

      if (!removed) {
        try {
          await ReactionModel.updateOne(
            key,
            { $set: { emoji: input.emoji } },
            { upsert: true },
          );
        } catch (err) {
          if ((err as { code?: number }).code !== 11000) throw err;
          await ReactionModel.updateOne(key, { $set: { emoji: input.emoji } });
        }
      }

      return {
        targetId: input.targetId,
        reactions: await readReactions(ctx.spaceId, input.targetType, input.targetId),
      };
    }),

  addNote: protectedProcedure
    .input(
      z.object({
        targetType: targetTypeInput,
        targetId: objectId,
        body: z.string().trim().min(1).max(NOTE_MAX_LENGTH),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const valid = await targetsInSpace(
        input.targetType,
        [input.targetId],
        ctx.spaceId,
      );
      if (!valid.has(input.targetId))
        throw new TRPCError({ code: "NOT_FOUND", message: "BAD_TARGET" });

      const doc = await NoteModel.create({
        spaceId: ctx.spaceId,
        targetType: input.targetType,
        targetId: input.targetId,
        userId: ctx.userId,
        body: input.body,
      });

      return {
        targetId: input.targetId,
        note: {
          id: String(doc._id),
          userId: ctx.userId,
          body: doc.body as string,
          createdAt: doc.createdAt as Date,
        },
      };
    }),

  /** Author-only delete, scoped to the caller's space. */
  removeNote: protectedProcedure
    .input(z.object({ id: objectId }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const doc = await NoteModel.findOne({ _id: input.id, spaceId: ctx.spaceId })
        .select("userId targetId")
        .lean<{ userId: string; targetId: string } | null>();
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      if (doc.userId !== ctx.userId)
        throw new TRPCError({ code: "FORBIDDEN", message: "NOT_AUTHOR" });

      await NoteModel.deleteOne({ _id: input.id, spaceId: ctx.spaceId });
      return { ok: true, id: input.id, targetId: doc.targetId };
    }),
});
