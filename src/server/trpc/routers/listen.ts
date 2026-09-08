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
        /**
         * Whether the inviter is playing right now.
         *
         * False when the invite comes from a card that was never started: the
         * host holds at the beginning until the answer comes, so the two of
         * them start together. It matters on the server as well as on screen,
         * because `respond` adds the waiting time to the playhead of a session
         * that says it is playing — an invite answered a minute later would
         * otherwise open both players a minute into the song.
         */
        isPlaying: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const partnerId = await partnerOf(ctx.spaceId, ctx.userId);
      const index = Math.min(input.index, input.queue.length - 1);

      /*
       * One session per space — replaced, and with a NEW id each time.
       *
       * This used to upsert on {spaceId}, which kept one document (one _id) per
       * space forever. Every event about a session carries its id, and the
       * client treats a repeated id as "nothing new" — so the SECOND time a
       * couple ended or declined a session, the other side never heard about
       * it and sat on "đang chờ" / "đang nghe cùng" indefinitely. Found by
       * three independent reviewers; the harness had missed it because it
       * deleted the document between runs. Delete-then-create gives each
       * session its own identity; the unique index still guarantees at most
       * one per space.
       */
      await ListenSessionModel.deleteMany({ spaceId: ctx.spaceId });
      const doc = (
        await ListenSessionModel.create({
          spaceId: ctx.spaceId,
          hostId: ctx.userId,
          guestId: partnerId,
          status: "inviting",
          queue: input.queue,
          index,
          isPlaying: input.isPlaying,
          positionSec: input.positionSec,
          stateAt: new Date(),
          updatedBy: ctx.userId,
          expiresAt: new Date(Date.now() + SIX_HOURS),
        })
      ).toObject() as SessionDoc;

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

      return { session: toView(doc), push: push ?? null };
    }),

  /** The guest answers. Accepting is what turns the invite into a session. */
  respond: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1), accept: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await connectToDatabase();
      const pending = await ListenSessionModel.findOne({
        _id: input.sessionId,
        spaceId: ctx.spaceId,
        // Only the person invited can answer, and only while it is unanswered.
        guestId: ctx.userId,
        status: "inviting",
      }).lean<SessionDoc>();
      if (!pending)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lời mời không còn nữa.",
        });

      /*
       * Re-base the playhead before re-stamping.
       *
       * The invite stored "position P, true at T0, playing". Accepting used to
       * write a new stateAt and leave P alone — so the document then claimed P
       * was true NOW, and the host, told about it, was yanked back by however
       * long the guest took to answer. If it was playing, P has moved on.
       */
      const now = Date.now();
      const positionSec = pending.isPlaying
        ? pending.positionSec +
          (now - new Date(pending.stateAt).getTime()) / 1000
        : pending.positionSec;

      const doc = await ListenSessionModel.findOneAndUpdate(
        { _id: pending._id, status: "inviting" },
        {
          status: input.accept ? "live" : "ended",
          updatedBy: ctx.userId,
          /*
           * Accepting is what starts the music. An invite sent from a card
           * that had not been played holds at the beginning — neither side
           * plays while it is pending — so the answer is the moment both
           * players are told to go, from the same point.
           */
          ...(input.accept ? { isPlaying: true } : {}),
          positionSec,
          stateAt: new Date(now),
          // A decline is over; keep it only long enough for both streams to see
          // the change, like `end` does — not the six hours a live session gets.
          expiresAt: new Date(now + (input.accept ? SIX_HOURS : 60 * 1000)),
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
      if (input.positionSec !== undefined)
        update.positionSec = input.positionSec;
      if (input.index !== undefined) {
        const nextIndex = Math.min(
          input.index,
          Math.max(0, doc.queue.length - 1),
        );
        update.index = nextIndex;
        // A DIFFERENT track starts at its beginning unless told otherwise. The
        // same index re-sent by the periodic full-state write is not a skip.
        if (input.positionSec === undefined && nextIndex !== doc.index)
          update.positionSec = 0;
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
