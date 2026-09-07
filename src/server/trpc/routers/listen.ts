import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { SpaceModel } from "@/server/db/models/space";
import { ListenSessionModel } from "@/server/db/models/listen-session";
import { sendPushToUser } from "@/server/lib/push";

/**
 * Listening together.
 *
 * The shape of a session, and the rules about it, live here rather than in the
 * dock: two devices have to agree on what is playing and where, and the only
 * thing they both see is this collection.
 *
 * Everything is scoped by `ctx.spaceId` through protectedProcedure, so one
 * couple can never read or drive another couple's session.
 */

const trackInput = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  title: z.string().min(1),
  thumbnailUrl: z.string().nullable().default(null),
  providerLabel: z.string().min(1),
  provider: z.string().min(1),
  embedUrl: z.string().min(1),
});

/** The wire shape both the SSE stream and these procedures hand back. */
export type ListenSessionView = {
  id: string;
  status: "inviting" | "live" | "ended";
  hostId: string;
  guestId: string;
  queue: Array<z.infer<typeof trackInput>>;
  index: number;
  isPlaying: boolean;
  positionSec: number;
  /**
   * How long ago that position was true, in milliseconds, measured on the
   * server.
   *
   * Not a timestamp: the two phones in a space disagree about what time it is,
   * often by minutes, and a follower that added its own clock to a server
   * timestamp would seek somewhere else entirely. An age is the same number on
   * every device.
   */
  stateAgeMs: number;
  updatedBy: string;
};

type SessionDoc = {
  _id: unknown;
  status: "inviting" | "live" | "ended";
  hostId: string;
  guestId: string;
  queue: Array<z.infer<typeof trackInput>>;
  index: number;
  isPlaying: boolean;
  positionSec: number;
  stateAt: Date;
  updatedBy: string;
};

function toView(doc: SessionDoc): ListenSessionView {
  return {
    id: String(doc._id),
    status: doc.status,
    hostId: doc.hostId,
    guestId: doc.guestId,
    queue: doc.queue ?? [],
    index: doc.index ?? 0,
    isPlaying: !!doc.isPlaying,
    positionSec: doc.positionSec ?? 0,
    stateAgeMs: Math.max(0, Date.now() - new Date(doc.stateAt).getTime()),
    updatedBy: doc.updatedBy,
  };
}

/** The other member of a two-person space. */
async function partnerOf(spaceId: string, userId: string): Promise<string> {
  const space = await SpaceModel.findById(spaceId)
    .select("members")
    .lean<{ members: string[] }>();
  if (!space) throw new TRPCError({ code: "FORBIDDEN", message: "NO_SPACE" });
  const partnerId = space.members.find((m) => m !== userId);
  if (!partnerId)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cần có 2 người trong không gian để nghe cùng nhau.",
    });
  return partnerId;
}

const SIX_HOURS = 6 * 60 * 60 * 1000;

export const listenRouter = router({
  /**
   * The live session, for a client that has just loaded.
   *
   * The SSE stream only pushes on change, so a page opened mid-session would
   * otherwise know nothing until the next time somebody pressed something.
   */
  current: protectedProcedure.query(async ({ ctx }) => {
    await connectToDatabase();
    const doc = await ListenSessionModel.findOne({
      spaceId: ctx.spaceId,
      status: { $in: ["inviting", "live"] },
    }).lean<SessionDoc>();
    return doc ? toView(doc) : null;
  }),

  /** Ask the partner to listen along with what is playing right now. */
  invite: protectedProcedure
    .input(
      z.object({
        queue: z.array(trackInput).min(1),
        index: z.number().int().min(0),
        positionSec: z.number().min(0).default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const partnerId = await partnerOf(ctx.spaceId, ctx.userId);
      const index = Math.min(input.index, input.queue.length - 1);

      /*
       * One session per space, replaced rather than appended to.
       *
       * The unique index on spaceId makes this the only shape that can exist,
       * which is what stops two half-live sessions from disagreeing about what
       * is playing — and re-inviting is how you change your mind about which
       * track to share, so overwriting is the intended behaviour.
       */
      const doc = await ListenSessionModel.findOneAndUpdate(
        { spaceId: ctx.spaceId },
        {
          spaceId: ctx.spaceId,
          hostId: ctx.userId,
          guestId: partnerId,
          status: "inviting",
          queue: input.queue,
          index,
          isPlaying: true,
          positionSec: input.positionSec,
          stateAt: new Date(),
          updatedBy: ctx.userId,
          expiresAt: new Date(Date.now() + SIX_HOURS),
        },
        { new: true, upsert: true },
      ).lean<SessionDoc>();

      /*
       * Reach the phone even when the app is closed — the same reasoning as the
       * navigation invite: an in-app listener only fires for a page that is
       * running. Awaited but never allowed to throw, because the invite exists
       * either way and losing it to a slow push service would be worse.
       */
      const track = input.queue[index];
      const push = await sendPushToUser(partnerId, {
        title: "Nghe cùng nhau nhé? 🎧",
        body: `Đang mở "${track.title}". Mở app để nghe cùng.`,
        url: "/library",
        // One pending invite at a time, so a new one replaces the old on screen.
        tag: "listen-invite",
      }).catch((err): null => {
        console.error("listen.invite: push failed", err);
        return null;
      });

      return { session: toView(doc!), push: push ?? null };
    }),

  /** The guest answers. Accepting is what turns the invite into a session. */
  respond: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1), accept: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const doc = await ListenSessionModel.findOneAndUpdate(
        {
          _id: input.sessionId,
          spaceId: ctx.spaceId,
          // Only the person invited can answer, and only while it is unanswered.
          guestId: ctx.userId,
          status: "inviting",
        },
        {
          status: input.accept ? "live" : "ended",
          updatedBy: ctx.userId,
          stateAt: new Date(),
          expiresAt: new Date(Date.now() + SIX_HOURS),
        },
        { new: true },
      ).lean<SessionDoc>();

      if (!doc)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lời mời không còn nữa.",
        });
      return toView(doc);
    }),

  /**
   * Anything either person does to the playback.
   *
   * Both members may drive a live session — the owner's call — so this takes
   * whichever fields changed and records who did it. Last write wins, which for
   * two people in one room is the behaviour they expect from a shared remote.
   */
  control: protectedProcedure
    .input(
      z.object({
        isPlaying: z.boolean().optional(),
        positionSec: z.number().min(0).optional(),
        index: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const doc = await ListenSessionModel.findOne({
        spaceId: ctx.spaceId,
        status: "live",
        $or: [{ hostId: ctx.userId }, { guestId: ctx.userId }],
      }).lean<SessionDoc & { queue: unknown[] }>();
      if (!doc) return null;

      const update: Record<string, unknown> = {
        updatedBy: ctx.userId,
        // Every control action re-times the state, because a pause or a skip
        // makes the stored position true as of NOW and not before.
        stateAt: new Date(),
        expiresAt: new Date(Date.now() + SIX_HOURS),
      };
      if (input.isPlaying !== undefined) update.isPlaying = input.isPlaying;
      if (input.positionSec !== undefined) update.positionSec = input.positionSec;
      if (input.index !== undefined) {
        update.index = Math.min(input.index, Math.max(0, doc.queue.length - 1));
        // A different track starts at its beginning unless told otherwise.
        if (input.positionSec === undefined) update.positionSec = 0;
      }

      const next = await ListenSessionModel.findOneAndUpdate(
        { _id: doc._id, status: "live" },
        update,
        { new: true },
      ).lean<SessionDoc>();
      return next ? toView(next) : null;
    }),

  /** Leave. Either person ending it ends it for both — it is one session. */
  end: protectedProcedure.mutation(async ({ ctx }) => {
    await connectToDatabase();
    await ListenSessionModel.updateOne(
      {
        spaceId: ctx.spaceId,
        status: { $in: ["inviting", "live"] },
        $or: [{ hostId: ctx.userId }, { guestId: ctx.userId }],
      },
      {
        status: "ended",
        updatedBy: ctx.userId,
        stateAt: new Date(),
        // Let it clear itself out shortly; kept briefly so both clients see
        // the "ended" state once rather than the document vanishing under them.
        expiresAt: new Date(Date.now() + 60 * 1000),
      },
    );
    return { ok: true };
  }),
});
