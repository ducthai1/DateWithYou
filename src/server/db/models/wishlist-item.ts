import { Schema, model, models, type InferSchemaType } from "mongoose";

/** Gift wishlist. `forWhom` = whose wish it is. */
const wishlistItemSchema = new Schema(
  {
    spaceId: { type: String, required: true, index: true },
    itemName: { type: String, required: true },
    forWhom: { type: String, enum: ["me", "partner"], default: "partner" },
    imageUrl: { type: String },
    price: { type: Number },
    sourceUrl: { type: String },
    bought: { type: Boolean, default: false },
    note: { type: String },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

export type WishlistItem = InferSchemaType<typeof wishlistItemSchema>;

export const WishlistItemModel =
  models.WishlistItem ?? model("WishlistItem", wishlistItemSchema);
