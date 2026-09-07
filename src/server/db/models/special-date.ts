import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * A meaningful date for the couple (anniversary, birthday, first kiss…). Stored
 * as a `YYYY-MM-DD` key; `recurYearly` events match by month/day every year and
 * drive the in-app countdown + ♥/★ markers on the calendar.
 */
const specialDateSchema = new Schema(
  {
    spaceId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    recurYearly: { type: Boolean, default: true },
    /**
     * Icon registry key (e.g. "heart", "cake") from icon-registry.ts.
     * Legacy docs may contain raw emoji strings — resolveIcon() handles the
     * fallback gracefully so old data is never a crash risk.
     */
    icon: { type: String },
    createdBy: { type: String, required: true },
    /**
     * Set when this row IS somebody's birthday, holding whose it is.
     *
     * Birthdays are ordinary recurring special dates — that is what puts them
     * in the countdown, the calendar grid and /home for free. This field only
     * answers "which row is mine", so the settings field can UPDATE it instead
     * of adding a new row on every save.
     */
    birthdayOf: { type: String },
  },
  { timestamps: true },
);

specialDateSchema.index({ spaceId: 1, date: 1 });
// One birthday row per person per space — the lookup the settings field does.
specialDateSchema.index({ spaceId: 1, birthdayOf: 1 });
// Serves activity.feed: find({ spaceId, createdAt: { $lt: before } })
// .sort({ createdAt: -1 }).limit(n) — and activity.unreadCount, which adds
// an equality-free createdAt range on the same prefix.
specialDateSchema.index({ spaceId: 1, createdAt: -1 });

export type SpecialDate = InferSchemaType<typeof specialDateSchema>;

export const SpecialDateModel =
  models.SpecialDate ?? model("SpecialDate", specialDateSchema);
