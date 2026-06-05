import { Schema, model, models } from "mongoose";

/** A defined good-deed task worth N points. */
const rewardTaskSchema = new Schema(
  {
    spaceId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    points: { type: Number, required: true, min: 1 },
  },
  { timestamps: true },
);

/** A log of a completed task (audit trail; balance is the authoritative counter). */
const rewardLogSchema = new Schema(
  {
    spaceId: { type: String, required: true, index: true },
    taskId: { type: String, required: true },
    userId: { type: String, required: true },
    points: { type: Number, required: true },
    doneAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

/** A redeemable reward. Single-use: `redeemed` is flipped atomically. */
const rewardVoucherSchema = new Schema(
  {
    spaceId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    cost: { type: Number, required: true, min: 1 },
    redeemed: { type: Boolean, default: false },
    redeemedBy: { type: String },
    redeemedAt: { type: Date },
  },
  { timestamps: true },
);

/** Authoritative per-user point balance, mutated via atomic $inc. */
const rewardAccountSchema = new Schema({
  spaceId: { type: String, required: true },
  userId: { type: String, required: true },
  balance: { type: Number, required: true, default: 0 },
});
rewardAccountSchema.index({ spaceId: 1, userId: 1 }, { unique: true });

export const RewardTaskModel =
  models.RewardTask ?? model("RewardTask", rewardTaskSchema);
export const RewardLogModel =
  models.RewardLog ?? model("RewardLog", rewardLogSchema);
export const RewardVoucherModel =
  models.RewardVoucher ?? model("RewardVoucher", rewardVoucherSchema);
export const RewardAccountModel =
  models.RewardAccount ?? model("RewardAccount", rewardAccountSchema);
