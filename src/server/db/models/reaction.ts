import { Schema, model, models, type InferSchemaType } from "mongoose";
import { REACTION_EMOJIS } from "@/lib/reactions";

/**
 * The palette a partner may react with, from the one list both ends read.
 *
 * Server-authoritative all the same: the tRPC input enum and the schema enum
 * below are both derived from it, so an emoji outside the set can never be
 * persisted even if a client sends one.
 */
export { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/reactions";

/**
 * Objects a reaction can hang off. Polymorphic from day one so reactions extend
 * to plans/trips/wishlist later without a data migration — only this list and
 * the target-existence guard in the router need to grow.
 */
export const REACTION_TARGET_TYPES = ["memory"] as const;

export type ReactionTargetType = (typeof REACTION_TARGET_TYPES)[number];

/**
 * One partner's single reaction to one object, scoped to a couple space.
 * Reacting again with a different emoji replaces it; reacting with the same
 * emoji removes it (see the `react` procedure).
 */
const reactionSchema = new Schema(
  {
    spaceId: { type: String, required: true },
    targetType: { type: String, required: true, enum: [...REACTION_TARGET_TYPES] },
    targetId: { type: String, required: true },
    userId: { type: String, required: true },
    emoji: { type: String, required: true, enum: [...REACTION_EMOJIS] },
  },
  { timestamps: true },
);

// One reaction per person per object. The toggle/replace semantics rely on the
// DB enforcing this rather than application code — two fast taps race
// otherwise and would leave a partner with two reactions on one memory.
//
// Its {spaceId, targetType, targetId} prefix also serves the batched `$in`
// lookup in `forTargets`, so no second index is declared: a separate 3-field
// index would be an exact prefix of this one and pure write overhead.
reactionSchema.index(
  { spaceId: 1, targetType: 1, targetId: 1, userId: 1 },
  { unique: true },
);

export type Reaction = InferSchemaType<typeof reactionSchema>;

export const ReactionModel = models.Reaction ?? model("Reaction", reactionSchema);
