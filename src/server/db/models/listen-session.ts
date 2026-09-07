import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * One shared listening session per space — "nghe cùng nhau".
 *
 * Modelled on NavigationInvite deliberately: the couple already knows that
 * flow ("Cùng khởi hành" → a card on the other phone → both are in it), and
 * reusing its shape means the same SSE stream, the same accept/decline modal
 * and the same TTL habits rather than a second set of conventions.
 *
 * One document, not two. A space has exactly two members, so the invite and
 * the session it turns into are the same thing at different stages:
 *
 *   inviting → live → ended            (or TTL, if nobody ever answers)
 *
 * Both members may control a live session — that was the owner's call, and it
 * is why there is no "controller" field: the last write wins and `updatedBy`
 * says whose it was, so the other side can say "người ấy vừa đổi bài" instead
 * of the music changing for no visible reason.
 */

/** Enough of a track to render the dock without a second query. */
const trackSchema = new Schema(
  {
    /** MediaItem id, so a card can highlight what is playing. */
    id: { type: String, required: true },
    kind: { type: String, required: true },
    title: { type: String, required: true },
    thumbnailUrl: { type: String, default: null },
    providerLabel: { type: String, required: true },
    provider: { type: String, required: true },
    embedUrl: { type: String, required: true },
  },
  { _id: false },
);

const listenSessionSchema = new Schema(
  {
    spaceId: { type: String, required: true, unique: true },
    /** Who opened it. Not a permission — only used for the invite copy. */
    hostId: { type: String, required: true },
    guestId: { type: String, required: true },
    status: {
      type: String,
      enum: ["inviting", "live", "ended"],
      default: "inviting",
    },
    /** The queue as the host had it, so the guest gets prev/next too. */
    queue: { type: [trackSchema], default: [] },
    index: { type: Number, default: 0 },
    isPlaying: { type: Boolean, default: true },
    /**
     * The playhead at `stateAt`, in seconds.
     *
     * Stored with the moment it was true rather than as a live value: a
     * follower that joins (or reloads) later has to know how much time has
     * passed since, or it would start everyone at the position the host was at
     * whenever they last touched anything. See `stateAt`.
     */
    positionSec: { type: Number, default: 0 },
    /**
     * When `positionSec` / `isPlaying` were true, server-side.
     *
     * The server sends the AGE of this to clients, never the timestamp itself —
     * two phones' clocks disagree by more than a song is long, and a follower
     * that trusted its own clock would seek to somewhere else entirely.
     */
    stateAt: { type: Date, default: () => new Date() },
    /** Whose action produced the current state. */
    updatedBy: { type: String, required: true },
    /**
     * TTL. Refreshed on every control, so a session being listened to never
     * expires under the people using it, while an invite nobody answers and a
     * session everyone walked away from both clear themselves out.
     */
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 6 * 60 * 60 * 1000),
      index: { expires: 0 },
    },
  },
  { timestamps: true },
);

/** The only lookup either side does: "what is my space listening to?" */
listenSessionSchema.index({ spaceId: 1, status: 1 });

export type ListenSessionTrack = InferSchemaType<typeof trackSchema>;
export type ListenSession = InferSchemaType<typeof listenSessionSchema>;

export const ListenSessionModel =
  models.ListenSession ?? model("ListenSession", listenSessionSchema);
