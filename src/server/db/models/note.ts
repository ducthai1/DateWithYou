import { Schema, model, models, type InferSchemaType } from "mongoose";
import { REACTION_TARGET_TYPES } from "./reaction";

/** Max characters in one note — a short reply, not an essay. */
export const NOTE_MAX_LENGTH = 500;

/**
 * A short note one partner leaves on a shared object.
 *
 * Deliberately FLAT — there is no parentId and there never should be. With
 * exactly two people in a space a thread has nothing to disambiguate, so notes
 * are rendered as one chronological list.
 */
const noteSchema = new Schema(
  {
    spaceId: { type: String, required: true },
    targetType: { type: String, required: true, enum: [...REACTION_TARGET_TYPES] },
    targetId: { type: String, required: true },
    userId: { type: String, required: true },
    body: { type: String, required: true, maxlength: NOTE_MAX_LENGTH },
  },
  { timestamps: true },
);

// Batched `$in` lookup per target, already ordered oldest → newest so the
// chronological read needs no in-memory sort.
noteSchema.index({ spaceId: 1, targetType: 1, targetId: 1, createdAt: 1 });

export type Note = InferSchemaType<typeof noteSchema>;

export const NoteModel = models.Note ?? model("Note", noteSchema);
