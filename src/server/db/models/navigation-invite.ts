import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Navigation Invite — represents a "Cùng khởi hành" request from one space
 * member to another. Documents self-destruct via a TTL index after 5 minutes
 * so the collection never accumulates stale invites.
 *
 * Status lifecycle: pending → accepted | rejected | expired (TTL)
 */
const navigationInviteSchema = new Schema(
  {
    spaceId: { type: String, required: true },
    /** The user who initiated the invite. */
    initiatorId: { type: String, required: true },
    /** The target user (partner in the space). */
    targetId: { type: String, required: true },
    /** The location they want to navigate to together. */
    locationId: { type: String, required: true },
    locationName: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    // TTL: auto-delete after 5 minutes so stale invites never pile up.
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 5 * 60 * 1000),
      index: { expires: 0 },
    },
  },
  { timestamps: true },
);

// Fast lookup: "do I have a pending invite?" per space + target user.
navigationInviteSchema.index({ spaceId: 1, targetId: 1, status: 1 });
// Fast lookup: "has my invite been responded to?" per initiator.
navigationInviteSchema.index({ spaceId: 1, initiatorId: 1, status: 1 });

export type NavigationInvite = InferSchemaType<typeof navigationInviteSchema>;

export const NavigationInviteModel =
  models.NavigationInvite ??
  model("NavigationInvite", navigationInviteSchema);
