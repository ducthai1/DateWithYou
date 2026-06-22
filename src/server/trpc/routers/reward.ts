import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { SpaceModel } from "@/server/db/models/space";
import {
  RewardTaskModel,
  RewardLogModel,
  RewardVoucherModel,
  RewardAccountModel,
} from "@/server/db/models/reward-models";

// FK guard: the credited/charged user must be a member of the caller's space.
async function assertMember(userId: string, spaceId: string): Promise<void> {
  const space = await SpaceModel.findOne({ _id: spaceId, members: userId })
    .select("_id")
    .lean();
  if (!space) throw new TRPCError({ code: "BAD_REQUEST", message: "NOT_A_MEMBER" });
}

export const rewardRouter = router({
  overview: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    const [tasks, vouchers, accounts, space, recentLogs] = await Promise.all([
      RewardTaskModel.find({ spaceId: ctx.spaceId }).lean(),
      RewardVoucherModel.find({ spaceId: ctx.spaceId }).sort({ createdAt: -1 }).lean(),
      RewardAccountModel.find({ spaceId: ctx.spaceId }).lean(),
      SpaceModel.findById(ctx.spaceId).select("members").lean<{ members: string[] }>(),
      RewardLogModel.find({ spaceId: ctx.spaceId }).sort({ doneAt: -1 }).limit(5).lean(),
    ]);
    const balanceOf = (uid: string) =>
      accounts.find((a) => String(a.userId) === String(uid))?.balance ?? 0;
    return {
      tasks: tasks.map((t) => ({ id: String(t._id), title: t.title, points: t.points })),
      vouchers: vouchers.map((v) => ({
        id: String(v._id),
        title: v.title,
        cost: v.cost,
        redeemed: Boolean(v.redeemed),
        redeemedBy: v.redeemedBy ?? null,
      })),
      balances: (space?.members ?? []).map((uid) => ({
        userId: uid,
        balance: balanceOf(uid),
        isMe: uid === ctx.userId,
      })),
      recentLogs: recentLogs.map((l) => {
        const taskTitle = tasks.find(t => String(t._id) === l.taskId)?.title ?? "Nhiệm vụ đã xoá";
        return {
          id: String(l._id),
          taskId: l.taskId,
          taskTitle,
          userId: l.userId,
          points: l.points,
          doneAt: l.doneAt as Date,
        };
      }),
    };
  }),

  createTask: protectedProcedure
    .input(z.object({ title: z.string().trim().min(1).max(120), points: z.number().int().min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const doc = await RewardTaskModel.create({ ...input, spaceId: ctx.spaceId });
      return { id: String(doc._id) };
    }),

  createVoucher: protectedProcedure
    .input(z.object({ title: z.string().trim().min(1).max(120), cost: z.number().int().min(1).max(100000) }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const doc = await RewardVoucherModel.create({ ...input, spaceId: ctx.spaceId });
      return { id: String(doc._id) };
    }),

  // Award a task's points to a member (atomic $inc on the balance counter).
  completeTask: protectedProcedure
    .input(z.object({ taskId: z.string(), forUserId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      await assertMember(input.forUserId, ctx.spaceId);
      const task = await RewardTaskModel.findOne({ _id: input.taskId, spaceId: ctx.spaceId })
        .select("points")
        .lean<{ points: number }>();
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      await RewardLogModel.create({
        spaceId: ctx.spaceId,
        taskId: input.taskId,
        userId: input.forUserId,
        points: task.points,
      });
      await RewardAccountModel.updateOne(
        { spaceId: ctx.spaceId, userId: input.forUserId },
        { $inc: { balance: task.points } },
        { upsert: true },
      );
      return { ok: true };
    }),

  // Redeem a single-use voucher: claim it atomically, then atomically deduct
  // points; roll the claim back if the balance was insufficient.
  redeem: protectedProcedure
    .input(z.object({ voucherId: z.string(), forUserId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      await assertMember(input.forUserId, ctx.spaceId);

      const voucher = await RewardVoucherModel.findOneAndUpdate(
        { _id: input.voucherId, spaceId: ctx.spaceId, redeemed: false },
        { $set: { redeemed: true, redeemedBy: input.forUserId, redeemedAt: new Date() } },
        { new: true },
      ).lean<{ cost: number }>();
      if (!voucher)
        throw new TRPCError({ code: "BAD_REQUEST", message: "ALREADY_REDEEMED" });

      const charged = await RewardAccountModel.findOneAndUpdate(
        { spaceId: ctx.spaceId, userId: input.forUserId, balance: { $gte: voucher.cost } },
        { $inc: { balance: -voucher.cost } },
        { new: true },
      ).lean();

      if (!charged) {
        // Insufficient points → undo OUR claim so the voucher stays available.
        // Scoped to this space + this claimant so we never clobber another redeem.
        await RewardVoucherModel.updateOne(
          { _id: input.voucherId, spaceId: ctx.spaceId, redeemedBy: input.forUserId },
          { $set: { redeemed: false }, $unset: { redeemedBy: "", redeemedAt: "" } },
        );
        throw new TRPCError({ code: "CONFLICT", message: "INSUFFICIENT_POINTS" });
      }
      return { ok: true };
    }),
});
