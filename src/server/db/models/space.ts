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
    /**
     * @deprecated No longer read by the render path. Kept so existing docs
     * don't fail on strict schema validation. Use `themePreset` instead.
     */
    themeColor: { type: String, default: "#b08968" },
    /**
     * Preset key from the theme registry (theme-presets.ts). This is the sole
     * source of truth for the couple's accent palette. The SSR layout reads
     * the `vivu_theme` cookie (written from this field) to set data-theme.
     */
    themePreset: { type: String, default: "terracotta" },
    anniversaryDate: { type: Date },
    members: { type: [String], required: true, default: [] },
    /**
     * @deprecated Legacy plaintext delete-PIN. Still read on delete for spaces
     * created before hashing, but never written anymore. Use `pinHash`.
     */
    pin: { type: String },
    // SHA-256 of the creator's delete-PIN (case-sensitive, trimmed). Optional —
    // a space with neither pin nor pinHash is deleted via type-the-name confirm.
    pinHash: { type: String },
    createdBy: { type: String },
    isPersonal: { type: Boolean, default: false },
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

// Allows efficient querying of spaces a user belongs to.
spaceSchema.index({ members: 1 });
// Speeds up joinByCode lookups (and avoids a full scan per brute-force attempt).
spaceSchema.index({ inviteCodeHash: 1 }, { sparse: true });

export type Space = InferSchemaType<typeof spaceSchema>;

export const SpaceModel = models.Space ?? model("Space", spaceSchema);
