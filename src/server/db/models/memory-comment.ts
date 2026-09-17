import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * A line somebody wrote under a memory.
 *
 * Its own collection rather than an array on the memory doc: comments are
 * appended over time by both people, and an array inside the memory would mean
 * every new line rewrites the whole document — including its photo list, which
 * two people editing at once can then lose from under each other. A separate
 * row also lets one comment be deleted without touching the memory at all.
 *
 * `spaceId` is stored even though it is derivable from the memory, because
 * every other collection here carries it: the space-delete cascade and the
 * isolation tests both filter on that one field, and a collection that answers
 * a different question is the one that gets forgotten.
 */
const memoryCommentSchema = new Schema(
  {
    spaceId: { type: String, required: true, index: true },
    memoryId: { type: String, required: true, index: true },
    authorId: { type: String, required: true },
    text: { type: String, required: true },
    /*
     * Members named in the text, as ids.
     *
     * Same reasoning as on the memory itself: the words keep the readable
     * "@Tên", this is the part the server acts on, and a display name changing
     * must not stop a notification from arriving.
     */
    mentions: { type: [String], default: [] },
  },
  { timestamps: true },
);

// Reading a memory's comments in the order they were written is the only query.
memoryCommentSchema.index({ memoryId: 1, createdAt: 1 });

export type MemoryComment = InferSchemaType<typeof memoryCommentSchema>;
export const MemoryCommentModel =
  models.MemoryComment || model("MemoryComment", memoryCommentSchema);
