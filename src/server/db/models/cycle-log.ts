import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * The dates behind the gentle reminder — one document per space.
 *
 * Only the start dates are stored. Everything the app shows (the rhythm, the
 * next expected date, the ± on it) is derived at read time by
 * `predictNextStart`, so there is no computed field here to drift out of date
 * when an entry is corrected.
 *
 * `YYYY-MM-DD` strings rather than Dates, matching every other day-keyed
 * feature in the app: a period starts on a calendar day in Saigon, not at an
 * instant, and a Date would invite an off-by-one across the timezone.
 */
const cycleLogSchema = new Schema(
  {
    spaceId: { type: String, required: true, unique: true },
    /** Period start dates, `YYYY-MM-DD`. Entered by hand, any order. */
    periodStarts: { type: [String], default: [] },
    /**
     * What the reminder cron last spoke about, as `<predictedDate>:<daysAhead>`.
     *
     * The cron runs daily but each moment must be said once. Keying on the
     * predicted date as well as the lead means a corrected entry (a new
     * predicted date) is allowed to speak again, while the same date on the
     * same lead never repeats.
     */
    lastRemindedKey: { type: String },
    updatedBy: { type: String },
  },
  { timestamps: true },
);

export type CycleLog = InferSchemaType<typeof cycleLogSchema>;

export const CycleLogModel = models.CycleLog ?? model("CycleLog", cycleLogSchema);
