import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Server errors, kept where somebody can actually see them.
 *
 * Before this the app had no error reporting of any kind: eighteen
 * `console.error` calls landing in Vercel's log stream, which nobody reads
 * unless they already suspect something. A feature could throw for every user
 * of one shape of data and the first anybody would know is a message saying
 * "it's broken".
 *
 * Deliberately not a third-party service. Signing up for one means an account
 * and usually a card, and this is a two-person app — a collection with a TTL
 * and an admin page answers the only question that matters ("is anything
 * failing, and what?") at no cost and with nothing sent to anyone else.
 *
 * **Deduplicated by fingerprint.** The same bug hit two hundred times is one
 * row with a count, not two hundred rows — otherwise the loudest error buries
 * the rarest, and the rare one is usually the interesting one.
 */
const errorLogSchema = new Schema(
  {
    /** Procedure path or route — where it happened, not what threw. */
    where: { type: String, required: true },
    /** Stable hash of where + message, so repeats fold together. */
    fingerprint: { type: String, required: true, unique: true },
    message: { type: String, required: true },
    /** Trimmed: the first frames are the ones that say anything. */
    stack: { type: String },
    count: { type: Number, default: 1 },
    firstAt: { type: Date, required: true },
    lastAt: { type: Date, required: true },
    /*
     * Who it happened to, for reproducing it — never what they were doing.
     * Procedure inputs carry notes, place names and messages between two
     * people; an error log is not a reason to keep any of that.
     */
    spaceId: { type: String },
    userId: { type: String },
    /** Mongo removes the row itself once this passes. */
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false },
);

errorLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
errorLogSchema.index({ lastAt: -1 });

export type ErrorLog = InferSchemaType<typeof errorLogSchema>;

export const ErrorLogModel = models.ErrorLog ?? model("ErrorLog", errorLogSchema);
