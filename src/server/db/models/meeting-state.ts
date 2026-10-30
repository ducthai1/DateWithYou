import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Whether the two members are together right now, as the server last judged
 * it from their positions (src/lib/meeting-detect.ts). One row per space; kept
 * so a meeting is announced once, not on every fix while they sit together.
 */
const meetingStateSchema = new Schema(
  {
    spaceId: { type: String, required: true, unique: true },
    together: { type: Boolean, default: null },
    at: { type: Date, default: null },
    announcedAt: { type: Date, default: null },
  },
  { versionKey: false },
);

export type MeetingState = InferSchemaType<typeof meetingStateSchema>;

export const MeetingStateModel = models.MeetingState ?? model("MeetingState", meetingStateSchema);
