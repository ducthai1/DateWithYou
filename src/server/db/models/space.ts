import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Couple Space — the tenant boundary. Every feature collection scopes by this
 * space's id. `members` holds Better Auth user ids (max 2, enforced atomically
 * in the space router). Invite codes are stored hashed + single-use + TTL.
 */
const spaceSchema = new Schema(
  {
    name: { type: String, required: true },
    coverImage: { type: String },
    themeColor: { type: String, default: "#b08968" },
    anniversaryDate: { type: Date },
    members: { type: [String], required: true, default: [] },
    inviteCodeHash: { type: String },
    inviteCodeExpiresAt: { type: Date },
    // Couple-defined tag palette for itinerary items (on top of the built-in
    // defaults merged in at read time). `nickname`/`avatarEmoji`/`avatarColor`
    // are optional per-member display overrides keyed by member userId.
    tags: {
      type: [{ name: String, color: String, icon: String }],
      default: [],
    },
    memberProfiles: {
      type: [{ userId: String, nickname: String, avatarEmoji: String, avatarColor: String }],
      default: [],
    },
  },
  { timestamps: true },
);

// Unique multikey index: a user id can appear in at most one space's members —
// enforces the 1-user-1-space invariant atomically even under concurrent joins.
spaceSchema.index({ members: 1 }, { unique: true });
// Speeds up joinByCode lookups (and avoids a full scan per brute-force attempt).
spaceSchema.index({ inviteCodeHash: 1 }, { sparse: true });

export type Space = InferSchemaType<typeof spaceSchema>;

export const SpaceModel = models.Space ?? model("Space", spaceSchema);
